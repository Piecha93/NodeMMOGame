import { legacyView } from "../replication/LegacyView";
import { GameObject } from "../game_utils/game/objects/GameObject";

import { GameObjectsFactory } from "../game_utils/factory/ObjectsFactory";
import { GameObjectsManager } from "../game_utils/factory/GameObjectsManager";
import { splitLegacyFrames, writeLegacyObjectId } from "./LegacyV1Frames";
import { ChunksManager } from "../chunks/ChunksManager";
import { Chunk } from "../chunks/Chunk";
import { LegacyV1Decoder, LegacyDecodePlan } from "./LegacyV1Decoder";
import { ProtocolLimits } from "../net/ProtocolLimits";
import { ProtocolDecodeError, ProtocolDecodeErrorCode } from "./ProtocolDecodeError";

export class UpdateCollector {
    private static OBJECT_ID_BYTES_LEN = 5;
    private static DESTROY_OBJECTS_ID = 255;

    private destroyedObjects: Map<Chunk, Set<string>> = new Map<Chunk, Set<string>>();
    private chunksManager: ChunksManager;
    private objectsManager: GameObjectsManager;
    private objectsFactory: GameObjectsFactory;
    private readonly decoder: LegacyV1Decoder;

    constructor(chunksManager: ChunksManager, objectsManager: GameObjectsManager, objectsFactory: GameObjectsFactory) {
        this.chunksManager = chunksManager;
        this.objectsManager = objectsManager;
        this.objectsFactory = objectsFactory;
        this.decoder = new LegacyV1Decoder(objectsFactory);

        for (const chunk of this.chunksManager.ChunksIterator()) {
            this.destroyedObjects.set(chunk, new Set<string>());
        }
    }

    public recordCreated(gameObject: GameObject) {
        const chunk = this.chunksManager.getObjectChunk(gameObject);
        if (!chunk) {
            return;
        }

        if (this.objectsFactory.Runtime.isServer) {
            this.destroyedObjects.get(chunk)?.delete(gameObject.ID);
        }
        gameObject.forceCompleteUpdate();
    }

    public recordDestroyed(gameObject: GameObject, oldChunk: Chunk | null | undefined) {
        if (this.objectsFactory.Runtime.isServer && oldChunk) {
            this.destroyedObjects.get(oldChunk)?.add(gameObject.ID);
        }
    }

    public collectUpdate(): Map<Chunk, ArrayBuffer> {
        const prepared = this.prepareUpdate();
        const updates = new Map<Chunk, ArrayBuffer>();
        for (const [chunk, frames] of prepared.frames) {
            if (frames.length !== 1) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT,
                    0,
                    "Chunk requires multiple legacy frames; use collectUpdateFrames",
                );
            }
            const frame = frames[0];
            if (frame) updates.set(chunk, frame);
        }
        prepared.commit();
        return updates;
    }

    public collectUpdateFrames(): Map<Chunk, ArrayBuffer[]> {
        const prepared = this.prepareUpdate();
        prepared.commit();
        return prepared.frames;
    }

    private prepareUpdate(): { frames: Map<Chunk, ArrayBuffer[]>; commit: () => void } {
        const updates = new Map<Chunk, ArrayBuffer[]>();
        const serializedObjects = new Set<GameObject>();
        const chunksToFinalize: Array<{ chunk: Chunk; resetCompleteUpdate: boolean }> = [];
        for (const chunk of this.chunksManager.ChunksIterator()) {
            const observed = chunk.HasPlayersInNeighborhood;
            chunksToFinalize.push({ chunk, resetCompleteUpdate: observed });
            if (!observed) continue;
            const complete = chunk.IsNextUpdateComplete;
            const destroyed = new Set(this.destroyedObjects.get(chunk));
            const objects = new Set([...chunk.Objects, ...chunk.Leavers]);
            const records: Uint8Array[] = [];
            for (const object of objects) {
                if (object.IsDestroyed) {
                    if (chunk.Leavers.includes(object)) destroyed.add(object.ID);
                    continue;
                }
                const needed = legacyView(object).calcNeededBufferSize(complete);
                if (needed === 0) continue;
                if (needed + 5 > ProtocolLimits.MAX_UPDATE_FRAME_BYTES) {
                    throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT, 0);
                }
                const record = new Uint8Array(needed + 5);
                const view = new DataView(record.buffer);
                writeLegacyObjectId(view, 0, object.ID);
                const endOffset = legacyView(object).serializePreservingChanges(view, 5, complete);
                if (endOffset !== record.byteLength) {
                    throw new ProtocolDecodeError(
                        ProtocolDecodeErrorCode.INVALID_SCHEMA,
                        5,
                        "serialized size differs from planned size",
                    );
                }
                records.push(record);
                serializedObjects.add(object);
            }
            const frames = splitLegacyFrames(records, [...destroyed]);
            if (frames.length > 0) updates.set(chunk, frames);
        }
        return {
            frames: updates,
            commit: () => {
                for (const object of serializedObjects) legacyView(object).commitSerializedChanges();
                for (const { chunk, resetCompleteUpdate } of chunksToFinalize) {
                    if (resetCompleteUpdate) chunk.IsNextUpdateComplete = false;
                    chunk.resetLeavers();
                    this.destroyedObjects.get(chunk)?.clear();
                }
            },
        };
    }

    public decodeUpdate(updateBuffer: ArrayBuffer) {
        this.decodeUpdateFrames([updateBuffer]);
    }

    public decodeUpdateFrames(buffers: readonly ArrayBuffer[]): void {
        const frames = this.decoder.preflightFrames(buffers);
        for (const { view, plan } of frames) this.applyDecodePlan(view, plan);
    }

    private applyDecodePlan(updateBufferView: DataView, plan: LegacyDecodePlan): void {
        for (const record of plan.records) {
            const gameObject: GameObject | undefined = this.objectsManager.get(record.id);
            if (gameObject) {
                const appliedEndOffset: number = legacyView(gameObject).deserialize(
                    updateBufferView,
                    record.dataOffset,
                );
                if (appliedEndOffset !== record.endOffset) {
                    throw new Error(
                        `Validated record '${record.id}' ended at ${record.endOffset}, ` +
                            `but deserialization ended at ${appliedEndOffset}`,
                    );
                }
            } else {
                this.objectsFactory.instantiate(record.prefabName, record.id, [updateBufferView, record.dataOffset]);
            }
        }

        for (const id of plan.tombstones) {
            this.objectsManager.destroy(id);
        }
    }
}
