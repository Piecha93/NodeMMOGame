import { legacyView } from "../replication/LegacyView";
import type { GameObject } from "../game_utils/game/objects/GameObject";
import type { Chunk } from "../chunks/Chunk";
import type { GameObjectsFactory } from "../game_utils/factory/ObjectsFactory";
import { LegacyV1Decoder } from "./LegacyV1Decoder";
import { splitLegacyFrames, writeLegacyObjectId } from "./LegacyV1Frames";
import { ProtocolLimits } from "../net/ProtocolLimits";
import { ProtocolDecodeError, ProtocolDecodeErrorCode } from "./ProtocolDecodeError";

export class ObjectsSerializer {
    static serializeRecordPreservingChanges(gameObject: GameObject, complete: boolean = true): Uint8Array {
        const needed = legacyView(gameObject).calcNeededBufferSize(complete) + 5;
        if (needed > ProtocolLimits.MAX_UPDATE_FRAME_BYTES) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT, 0);
        }
        const bytes = new Uint8Array(needed);
        const view = new DataView(bytes.buffer);
        writeLegacyObjectId(view, 0, gameObject.ID);
        if (legacyView(gameObject).serializePreservingChanges(view, 5, complete) !== bytes.byteLength) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.INVALID_SCHEMA, 5, "unexpected serialized size");
        }
        return bytes;
    }

    static serializeObject(gameObject: GameObject): DataView {
        const bytes = this.serializeRecordPreservingChanges(gameObject);
        return new DataView(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
    }

    private static prepareChunk(chunk: Chunk): { frames: ArrayBuffer[]; objects: GameObject[] } {
        const objects = chunk.Objects.filter((object) => !object.IsDestroyed);
        const records = objects.map((object) => this.serializeRecordPreservingChanges(object));
        return { objects, frames: splitLegacyFrames(records) };
    }

    static serializeChunk(chunk: Chunk): ArrayBuffer {
        const prepared = this.prepareChunk(chunk);
        if (prepared.frames.length > 1) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT,
                0,
                "Chunk requires multiple frames; use serializeChunkFrames",
            );
        }
        for (const object of prepared.objects) legacyView(object).commitSerializedChanges();
        return prepared.frames[0] ?? new ArrayBuffer(0);
    }

    static serializeChunkFrames(chunk: Chunk): ArrayBuffer[] {
        const prepared = this.prepareChunk(chunk);
        for (const object of prepared.objects) legacyView(object).commitSerializedChanges();
        return prepared.frames;
    }

    static deserializeChunk(buffer: ArrayBuffer, factory: GameObjectsFactory): void {
        this.deserializeChunkFrames(buffer.byteLength === 0 ? [] : [buffer], factory);
    }

    static deserializeChunkFrames(buffers: readonly ArrayBuffer[], factory: GameObjectsFactory): void {
        const validated = new LegacyV1Decoder(factory).preflightFrames(buffers, true);
        const ids = new Set<string>();
        for (const { plan } of validated) {
            if (plan.tombstones.length > 0) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.INVALID_TOMBSTONE_SECTION,
                    0,
                    "Chunk persistence cannot contain tombstones",
                );
            }
            for (const record of plan.records) {
                if (ids.has(record.id) || factory.Manager.get(record.id)) {
                    throw new ProtocolDecodeError(ProtocolDecodeErrorCode.DUPLICATE_OBJECT_ID, record.dataOffset - 5);
                }
                ids.add(record.id);
            }
        }
        for (const { view, plan } of validated) {
            for (const record of plan.records) {
                factory.instantiate(record.prefabName, record.id, [view, record.dataOffset]);
            }
        }
    }
}
