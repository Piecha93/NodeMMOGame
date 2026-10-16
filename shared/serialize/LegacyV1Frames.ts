import { ProtocolLimits } from "../net/ProtocolLimits";
import { ProtocolDecodeError, ProtocolDecodeErrorCode } from "./ProtocolDecodeError";

export const LEGACY_BATCH_LIMITS = Object.freeze({ MAX_FRAMES: 256, MAX_TOTAL_BYTES: 8 * 1024 * 1024 });

export function writeLegacyObjectId(view: DataView, offset: number, id: string): void {
    const sequence = Number(id.slice(1));
    if (
        id.length < 2 ||
        id.charCodeAt(0) >= 0xff ||
        !/^(0|[1-9]\d*)$/.test(id.slice(1)) ||
        !Number.isSafeInteger(sequence) ||
        sequence > 0xffffffff
    ) {
        throw new ProtocolDecodeError(ProtocolDecodeErrorCode.INVALID_SCHEMA, offset, "invalid object ID");
    }
    view.setUint8(offset, id.charCodeAt(0));
    view.setUint32(offset + 1, sequence);
}

/** Splits only at record boundaries, preserving the exact bytes of small v1 frames. */
export function splitLegacyFrames(records: readonly Uint8Array[], tombstones: readonly string[] = []): ArrayBuffer[] {
    const frames: ArrayBuffer[] = [];
    let parts: Uint8Array[] = [];
    let bytes = 0;
    let recordCount = 0;
    let tombstoneCount = 0;
    let totalBytes = 0;
    const flush = () => {
        if (bytes === 0) return;
        if (
            frames.length >= LEGACY_BATCH_LIMITS.MAX_FRAMES ||
            totalBytes + bytes > LEGACY_BATCH_LIMITS.MAX_TOTAL_BYTES
        ) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT, 0, "legacy batch limit exceeded");
        }
        const buffer = new ArrayBuffer(bytes);
        const output = new Uint8Array(buffer);
        let offset = 0;
        for (const part of parts) {
            output.set(part, offset);
            offset += part.byteLength;
        }
        frames.push(buffer);
        totalBytes += bytes;
        parts = [];
        bytes = 0;
        recordCount = 0;
        tombstoneCount = 0;
    };
    for (const record of records) {
        if (record.byteLength < 6 || record.byteLength > ProtocolLimits.MAX_UPDATE_FRAME_BYTES) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT,
                0,
                "single legacy record exceeds frame limit",
            );
        }
        if (
            recordCount >= ProtocolLimits.MAX_OBJECT_RECORDS_PER_FRAME ||
            bytes + record.byteLength > ProtocolLimits.MAX_UPDATE_FRAME_BYTES
        ) {
            flush();
        }
        parts.push(record);
        bytes += record.byteLength;
        recordCount++;
    }
    for (const id of tombstones) {
        const overhead = tombstoneCount === 0 ? 1 : 0;
        if (
            tombstoneCount >= ProtocolLimits.MAX_TOMBSTONES_PER_FRAME ||
            bytes + overhead + 5 > ProtocolLimits.MAX_UPDATE_FRAME_BYTES
        ) {
            flush();
        }
        if (tombstoneCount === 0) {
            parts.push(Uint8Array.of(255));
            bytes++;
        }
        const encodedId = new Uint8Array(5);
        writeLegacyObjectId(new DataView(encodedId.buffer), 0, id);
        parts.push(encodedId);
        bytes += 5;
        tombstoneCount++;
    }
    flush();
    return frames;
}
