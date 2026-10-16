import { legacyView } from "../replication/LegacyView";
import type { GameObject } from "../game_utils/game/objects/GameObject";
import type { GameObjectsFactory } from "../game_utils/factory/ObjectsFactory";
import { Transform } from "../game_utils/physics/Transform";
import { ProtocolLimits } from "../net/ProtocolLimits";
import { ProtocolDecodeError, ProtocolDecodeErrorCode } from "./ProtocolDecodeError";
import { LEGACY_BATCH_LIMITS } from "./LegacyV1Frames";

const OBJECT_ID_BYTES_LEN = 5;
const DESTROY_OBJECTS_ID = 255;

export interface LegacyDecodeRecordPlan {
    id: string;
    prefabName: string;
    dataOffset: number;
    endOffset: number;
}
export interface LegacyDecodePlan {
    records: LegacyDecodeRecordPlan[];
    tombstones: string[];
}

/** Compatibility adapter for the declaration-ordered v1 schema. */
export class LegacyV1Decoder {
    private readonly decodeSchemaObjects = new Map<string, GameObject>();
    private readonly objectsManager;
    constructor(private readonly objectsFactory: GameObjectsFactory) {
        this.objectsManager = objectsFactory.Manager;
    }
    preflightFrames(
        buffers: readonly ArrayBuffer[],
        requireComplete: boolean = false,
    ): Array<{ view: DataView; plan: LegacyDecodePlan }> {
        if (
            buffers.length > LEGACY_BATCH_LIMITS.MAX_FRAMES ||
            buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0) > LEGACY_BATCH_LIMITS.MAX_TOTAL_BYTES
        ) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT, 0, "legacy batch limit exceeded");
        }
        return buffers.map((buffer) => {
            const view = new DataView(buffer);
            return { view, plan: this.preflight(view, requireComplete) };
        });
    }

    preflight(updateBufferView: DataView, requireComplete: boolean = false): LegacyDecodePlan {
        if (updateBufferView.byteLength === 0) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.EMPTY_UPDATE, 0);
        }
        if (updateBufferView.byteLength > ProtocolLimits.MAX_UPDATE_FRAME_BYTES) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT, 0);
        }

        const records: LegacyDecodeRecordPlan[] = [];
        const tombstones: string[] = [];
        const updatedIds: Set<string> = new Set<string>();
        const tombstoneIds: Set<string> = new Set<string>();
        let offset: number = 0;

        while (offset < updateBufferView.byteLength) {
            const recordOffset: number = offset;
            const prefabByte: number = updateBufferView.getUint8(recordOffset);
            if (prefabByte === DESTROY_OBJECTS_ID) {
                offset = recordOffset + 1;
                if (offset === updateBufferView.byteLength) {
                    throw new ProtocolDecodeError(ProtocolDecodeErrorCode.INVALID_TOMBSTONE_SECTION, recordOffset);
                }

                while (offset < updateBufferView.byteLength) {
                    const tombstoneOffset: number = offset;
                    if (updateBufferView.byteLength - tombstoneOffset < OBJECT_ID_BYTES_LEN) {
                        throw new ProtocolDecodeError(ProtocolDecodeErrorCode.TRUNCATED_TOMBSTONE_ID, tombstoneOffset);
                    }

                    const id: string = this.readObjectId(updateBufferView, tombstoneOffset);
                    if (!this.objectsFactory.Catalog.IdToPrefabNames.has(id.charAt(0))) {
                        throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UNKNOWN_PREFAB, tombstoneOffset);
                    }
                    if (tombstoneIds.has(id)) {
                        throw new ProtocolDecodeError(ProtocolDecodeErrorCode.DUPLICATE_TOMBSTONE_ID, tombstoneOffset);
                    }
                    if (updatedIds.has(id)) {
                        throw new ProtocolDecodeError(
                            ProtocolDecodeErrorCode.UPDATE_TOMBSTONE_CONFLICT,
                            tombstoneOffset,
                        );
                    }

                    tombstoneIds.add(id);
                    tombstones.push(id);
                    if (tombstones.length > ProtocolLimits.MAX_TOMBSTONES_PER_FRAME) {
                        throw new ProtocolDecodeError(ProtocolDecodeErrorCode.RECORD_LIMIT, tombstoneOffset);
                    }
                    offset += OBJECT_ID_BYTES_LEN;
                }
                break;
            }

            if (updateBufferView.byteLength - recordOffset < OBJECT_ID_BYTES_LEN) {
                throw new ProtocolDecodeError(ProtocolDecodeErrorCode.TRUNCATED_OBJECT_HEADER, recordOffset);
            }

            const prefabId: string = String.fromCharCode(prefabByte);
            const prefabName: string | undefined = this.objectsFactory.Catalog.IdToPrefabNames.get(prefabId);
            const prefabType = prefabName ? this.objectsFactory.Catalog.PrefabsNameToTypes.get(prefabName) : undefined;
            if (!prefabName || !prefabType) {
                throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UNKNOWN_PREFAB, recordOffset);
            }

            const id: string = this.readObjectId(updateBufferView, recordOffset);
            if (updatedIds.has(id)) {
                throw new ProtocolDecodeError(ProtocolDecodeErrorCode.DUPLICATE_OBJECT_ID, recordOffset);
            }

            const existingObject: GameObject | undefined = this.objectsManager.get(id);
            if (existingObject && !(existingObject instanceof prefabType)) {
                throw new ProtocolDecodeError(ProtocolDecodeErrorCode.PREFAB_MISMATCH, recordOffset);
            }

            const schemaObject: GameObject = existingObject ?? this.getDecodeSchemaObject(prefabName);
            const dataOffset: number = recordOffset + OBJECT_ID_BYTES_LEN;
            const endOffset: number = legacyView(schemaObject).preflightDeserialize(
                updateBufferView,
                dataOffset,
                requireComplete || existingObject === undefined,
            );

            updatedIds.add(id);
            records.push({ id, prefabName, dataOffset, endOffset });
            if (records.length > ProtocolLimits.MAX_OBJECT_RECORDS_PER_FRAME) {
                throw new ProtocolDecodeError(ProtocolDecodeErrorCode.RECORD_LIMIT, recordOffset);
            }
            offset = endOffset;
        }

        return { records, tombstones };
    }

    private getDecodeSchemaObject(prefabName: string): GameObject {
        let schemaObject: GameObject | undefined = this.decodeSchemaObjects.get(prefabName);
        if (schemaObject) {
            return schemaObject;
        }

        const prefabType = this.objectsFactory.Catalog.PrefabsNameToTypes.get(prefabName);
        if (!prefabType) {
            throw new Error(`Missing registered prefab schema '${prefabName}'`);
        }

        // Read declaration-order metadata through prototypes without running
        // entity constructors, collision allocation, RNG or world callbacks.
        schemaObject = Object.create(prefabType.prototype) as GameObject;
        Object.defineProperty(schemaObject, "transform", { value: Object.freeze(Object.create(Transform.prototype)) });
        Object.freeze(schemaObject);
        this.decodeSchemaObjects.set(prefabName, schemaObject);
        return schemaObject;
    }

    private readObjectId(updateBufferView: DataView, offset: number): string {
        return (
            String.fromCharCode(updateBufferView.getUint8(offset)) + updateBufferView.getUint32(offset + 1).toString()
        );
    }
}
