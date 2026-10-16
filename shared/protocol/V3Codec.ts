import { entityId, requireObject, schemaForPrefab, selectFields, validateField } from "./CodecFields";
import type { SelectedField } from "./CodecFields";
import { ProtocolError, ProtocolErrorCode } from "./ProtocolError";
import { ENTITY_SCHEMAS, SCHEMAS_BY_WIRE_ID, V2_LIMITS } from "./Schema";
import type { EntitySchema } from "./Schema";
import { requireUint32 } from "./Sequence";
import type {
    DecodedFrame,
    EntityFields,
    EntityRecord,
    EntityState,
    FieldValue,
    Snapshot,
    TransformState,
} from "./Types";

export const PROTOCOL_V3 = 3;
export const V3_SCHEMA_VERSION = 1;
export const V3_HEADER_BYTES = 32;
export const V3_MAGIC = 0x4e4d4d33; // NMM3, network byte order.

const ACK_FLAG = 1;
const LOCAL_PLAYER_FLAG = 2;
const FIRST_PREFAB_ID = 0x41;
const MAX_FIELD_MASK = 2 ** 35 - 1;
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// Bits refer to explicit, stable field IDs, never declaration/array order.
const schemaMetadata = new Map(
    Object.values(ENTITY_SCHEMAS).map((schema) => [
        schema,
        Object.freeze({
            fieldsByBit: Object.freeze(
                Array.from({ length: 35 }, (_, bit) => schema.fields.find((field) => field.id === bit + 1)),
            ),
            mask: schema.fields.reduce((mask, field) => mask + 2 ** (field.id - 1), 0),
            lowMask: schema.fields.reduce((mask, field) => (field.id <= 32 ? mask | (1 << (field.id - 1)) : mask), 0),
            highMask: schema.fields.reduce((mask, field) => (field.id > 32 ? mask | (1 << (field.id - 33)) : mask), 0),
        }),
    ]),
);

function varintBytes(value: number): number {
    let count = 1;
    while (value >= 128) {
        value = Math.floor(value / 128);
        count++;
    }
    return count;
}

interface PreparedRecord {
    readonly tag: number;
    readonly sequence: number;
    readonly fields: readonly SelectedField[];
    readonly mask: number;
    readonly bytes: number;
    readonly fullPrecision: boolean;
}

function prepareRecord(record: EntityRecord, fullPrecision = false): PreparedRecord {
    requireObject(record, "record");
    let schema: EntitySchema;
    let id: unknown;
    let fields: SelectedField[] = [];
    let kind: number;
    if (record.kind === "destroy") {
        schema = entityId(record.id).schema;
        id = record.id;
        kind = 2;
    } else if (record.kind === "create") {
        requireObject(record.state, "state");
        schema = schemaForPrefab(record.state.prefab);
        id = record.state.id;
        fields = selectFields(schema, record.state.transform, record.state.fields, true);
        kind = 0;
    } else if (record.kind === "update") {
        schema = schemaForPrefab(record.prefab);
        id = record.id;
        fields = selectFields(schema, record.transform, record.fields, false);
        kind = 1;
    } else {
        throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD);
    }
    const { sequence } = entityId(id, schema);
    const prefabId = schema.wireId - FIRST_PREFAB_ID;
    if (prefabId < 0 || prefabId > 63) throw new ProtocolError(ProtocolErrorCode.UNKNOWN_PREFAB);
    fields.sort((left, right) => left.schema.id - right.schema.id);
    let mask = 0;
    let bytes = 1 + varintBytes(sequence);
    for (const field of fields) {
        mask += 2 ** (field.schema.id - 1);
        if (field.schema.type === "string") {
            bytes += varintBytes(field.bytes) + field.bytes;
        } else if (field.schema.type === "float64") {
            if (!fullPrecision) {
                // Validate the actual wire value too, preserving decoder symmetry
                // if schema bounds later stop being exactly representable in f32.
                validateField(field.schema, Math.fround(field.value as number));
            }
            bytes += fullPrecision ? 8 : 4;
        } else if (field.schema.type === "uint16") {
            bytes += varintBytes(field.value as number);
        } else {
            bytes++;
        }
    }
    if (kind !== 2) bytes += varintBytes(mask);
    if (bytes + V3_HEADER_BYTES > V2_LIMITS.MAX_FRAME_BYTES) throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT);
    return { tag: (kind << 6) | prefabId, sequence, fields, mask, bytes, fullPrecision };
}

function recordId(record: EntityRecord): string {
    return record.kind === "create" ? record.state.id : record.id;
}

class Writer {
    readonly view: DataView;
    readonly bytes: Uint8Array;
    offset = V3_HEADER_BYTES;

    constructor(readonly buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
        this.bytes = new Uint8Array(buffer);
    }

    varint(value: number): void {
        while (value >= 128) {
            this.bytes[this.offset++] = (value % 128) | 128;
            value = Math.floor(value / 128);
        }
        this.bytes[this.offset++] = value;
    }

    record(record: PreparedRecord): void {
        this.bytes[this.offset++] = record.tag;
        this.varint(record.sequence);
        if (record.tag >>> 6 === 2) return;
        this.varint(record.mask);
        for (const field of record.fields) {
            switch (field.schema.type) {
                case "float64":
                    if (record.fullPrecision) {
                        this.view.setFloat64(this.offset, field.value as number);
                        this.offset += 8;
                    } else {
                        this.view.setFloat32(this.offset, field.value as number);
                        this.offset += 4;
                    }
                    break;
                case "uint16":
                    this.varint(field.value as number);
                    break;
                case "bool":
                    this.bytes[this.offset++] = field.value === true ? 1 : 0;
                    break;
                case "string":
                    this.varint(field.bytes);
                    this.bytes.set(field.utf8!, this.offset);
                    this.offset += field.bytes;
                    break;
            }
        }
    }
}

/** Compact schema-driven snapshots. Only remote presentation state uses float32. */
export function encodeSnapshotV3(snapshot: Snapshot): readonly ArrayBuffer[] {
    requireObject(snapshot, "snapshot");
    const serverTick = requireUint32(snapshot.serverTick, "server tick");
    const snapshotId = requireUint32(snapshot.snapshotId, "snapshot ID");
    const ack =
        snapshot.lastProcessedInputSeq === null ? null : requireUint32(snapshot.lastProcessedInputSeq, "input ACK");
    if (!Array.isArray(snapshot.records) || snapshot.records.length > V2_LIMITS.MAX_SNAPSHOT_RECORDS) {
        throw new ProtocolError(ProtocolErrorCode.RECORD_LIMIT);
    }
    if (snapshot.localPlayerState !== undefined && snapshot.localPlayerState.prefab !== "DefaultPlayer") {
        throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, 0, "local player must be a complete player");
    }
    const local =
        snapshot.localPlayerState === undefined
            ? undefined
            : prepareRecord({ kind: "create", state: snapshot.localPlayerState }, true);
    let current: PreparedRecord[] = [];
    const groups: PreparedRecord[][] = [current];
    let currentSize = V3_HEADER_BYTES + (local?.bytes ?? 0);
    let totalBytes = currentSize;
    const ids = new Set<string>();
    for (const record of snapshot.records) {
        const prepared = prepareRecord(record);
        const id = recordId(record);
        if (ids.has(id)) throw new ProtocolError(ProtocolErrorCode.DUPLICATE_ENTITY, 0, id);
        ids.add(id);
        if (
            current.length >= V2_LIMITS.MAX_RECORDS_PER_FRAME ||
            currentSize + prepared.bytes > V2_LIMITS.MAX_FRAME_BYTES
        ) {
            current = [];
            groups.push(current);
            currentSize = V3_HEADER_BYTES;
            totalBytes += V3_HEADER_BYTES;
        }
        current.push(prepared);
        currentSize += prepared.bytes;
        totalBytes += prepared.bytes;
        if (groups.length > V2_LIMITS.MAX_BATCHES) throw new ProtocolError(ProtocolErrorCode.BATCH_LIMIT);
        if (totalBytes > V2_LIMITS.MAX_SNAPSHOT_BYTES) throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT);
    }
    return Object.freeze(
        groups.map((records, batchIndex) => {
            const localRecord = batchIndex === 0 ? local : undefined;
            const length =
                V3_HEADER_BYTES + (localRecord?.bytes ?? 0) + records.reduce((sum, record) => sum + record.bytes, 0);
            const writer = new Writer(new ArrayBuffer(length));
            const view = writer.view;
            view.setUint32(0, V3_MAGIC);
            view.setUint8(4, PROTOCOL_V3);
            view.setUint8(5, (ack === null ? 0 : ACK_FLAG) | (localRecord === undefined ? 0 : LOCAL_PLAYER_FLAG));
            view.setUint16(6, V3_HEADER_BYTES);
            view.setUint32(8, length);
            view.setUint32(12, serverTick);
            view.setUint32(16, snapshotId);
            view.setUint32(20, ack ?? 0);
            view.setUint16(24, batchIndex);
            view.setUint16(26, groups.length);
            view.setUint16(28, records.length);
            view.setUint16(30, V3_SCHEMA_VERSION);
            if (localRecord) writer.record(localRecord);
            for (const record of records) writer.record(record);
            return writer.buffer;
        }),
    );
}

class Reader {
    readonly view: DataView;
    offset = 0;

    constructor(readonly buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
    }

    require(length: number): void {
        if (!Number.isSafeInteger(length) || length < 0 || this.offset + length > this.view.byteLength) {
            throw new ProtocolError(ProtocolErrorCode.TRUNCATED, this.offset);
        }
    }

    uint8(): number {
        this.require(1);
        return this.view.getUint8(this.offset++);
    }

    uint16(): number {
        this.require(2);
        const value = this.view.getUint16(this.offset);
        this.offset += 2;
        return value;
    }

    uint32(): number {
        this.require(4);
        const value = this.view.getUint32(this.offset);
        this.offset += 4;
        return value;
    }

    varint(maximum: number): number {
        const start = this.offset;
        const maximumBytes = varintBytes(maximum);
        let value = 0;
        let multiplier = 1;
        for (let index = 0; index < maximumBytes; index++) {
            const byte = this.uint8();
            value += (byte & 127) * multiplier;
            if (value > maximum) throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, start, "varint overflow");
            if ((byte & 128) === 0) {
                if (index > 0 && byte === 0)
                    throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, start, "noncanonical varint");
                return value;
            }
            multiplier *= 128;
        }
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, start, "varint overflow");
    }
}

function readRecord(reader: Reader, fullPrecision = false): EntityRecord {
    const start = reader.offset;
    const tag = reader.uint8();
    const kind = tag >>> 6;
    if (kind === 3) throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, start);
    const schema = SCHEMAS_BY_WIRE_ID[(tag & 63) + FIRST_PREFAB_ID];
    if (!schema) throw new ProtocolError(ProtocolErrorCode.UNKNOWN_PREFAB, start);
    const sequence = reader.varint(0xffffffff);
    const id = schema.idPrefix + sequence.toString();
    if (kind === 2) return Object.freeze({ kind: "destroy", id });
    const maskOffset = reader.offset;
    const mask = reader.varint(MAX_FIELD_MASK);
    const metadata = schemaMetadata.get(schema)!;
    if (mask === 0)
        throw new ProtocolError(
            kind === 0 ? ProtocolErrorCode.INCOMPLETE_CREATE : ProtocolErrorCode.EMPTY_UPDATE,
            maskOffset,
        );
    let low = mask >>> 0;
    let high = Math.floor(mask / 0x100000000);
    if ((low & ~metadata.lowMask) !== 0 || (high & ~metadata.highMask) !== 0)
        throw new ProtocolError(ProtocolErrorCode.UNKNOWN_FIELD, maskOffset);
    if (kind === 0 && mask !== metadata.mask) throw new ProtocolError(ProtocolErrorCode.INCOMPLETE_CREATE, start);
    const fields: Record<string, FieldValue> = {};
    const transform: Record<string, number> = {};
    // Visit only present fields: the usual x/y update does two iterations,
    // independent of the total number of fields in the actor schema.
    while (low !== 0 || high !== 0) {
        let bit: number;
        if (low !== 0) {
            bit = 31 - Math.clz32(low & -low);
            low = (low & (low - 1)) >>> 0;
        } else {
            bit = 63 - Math.clz32(high & -high);
            high &= high - 1;
        }
        const field = metadata.fieldsByBit[bit]!;
        const payloadOffset = reader.offset;
        let value: FieldValue;
        switch (field.type) {
            case "string": {
                const length = reader.varint(V2_LIMITS.MAX_STRING_BYTES);
                if (length > (field.maxBytes ?? V2_LIMITS.MAX_STRING_BYTES))
                    throw new ProtocolError(ProtocolErrorCode.STRING_LIMIT, payloadOffset);
                reader.require(length);
                try {
                    value = textDecoder.decode(new Uint8Array(reader.buffer, reader.offset, length));
                } catch {
                    throw new ProtocolError(ProtocolErrorCode.INVALID_UTF8, reader.offset);
                }
                reader.offset += length;
                break;
            }
            case "float64":
                reader.require(fullPrecision ? 8 : 4);
                value = fullPrecision ? reader.view.getFloat64(reader.offset) : reader.view.getFloat32(reader.offset);
                reader.offset += fullPrecision ? 8 : 4;
                break;
            case "uint16":
                value = reader.varint(0xffff);
                break;
            case "bool": {
                const bool = reader.uint8();
                if (bool > 1) throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, payloadOffset);
                value = bool === 1;
                break;
            }
        }
        validateField(field, value, payloadOffset);
        if (field.section === "transform") transform[field.name] = value as number;
        else fields[field.name] = value;
    }
    if (kind === 0) {
        const state: EntityState = Object.freeze({
            id,
            prefab: schema.prefab,
            transform: Object.freeze(transform) as unknown as TransformState,
            fields: Object.freeze(fields),
        });
        return Object.freeze({ kind: "create", state });
    }
    return Object.freeze({
        kind: "update",
        id,
        prefab: schema.prefab,
        ...(Object.keys(transform).length === 0 ? {} : { transform: Object.freeze(transform) }),
        ...(Object.keys(fields).length === 0 ? {} : { fields: Object.freeze(fields) as EntityFields }),
    });
}

/** Diagnostic only. Apply after decodeSnapshotV3 validates the entire batch set. */
export function decodeFrameV3(buffer: ArrayBuffer): DecodedFrame {
    if (!(buffer instanceof ArrayBuffer)) throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE);
    if (buffer.byteLength > V2_LIMITS.MAX_FRAME_BYTES) throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT);
    const reader = new Reader(buffer);
    reader.require(V3_HEADER_BYTES);
    if (reader.uint32() !== V3_MAGIC) throw new ProtocolError(ProtocolErrorCode.BAD_MAGIC, 0);
    if (reader.uint8() !== PROTOCOL_V3) throw new ProtocolError(ProtocolErrorCode.UNSUPPORTED_VERSION, 4);
    const flags = reader.uint8();
    if ((flags & ~(ACK_FLAG | LOCAL_PLAYER_FLAG)) !== 0) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 5);
    if (reader.uint16() !== V3_HEADER_BYTES) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 6);
    if (reader.uint32() !== buffer.byteLength) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 8);
    const serverTick = reader.uint32();
    const snapshotId = reader.uint32();
    const ack = reader.uint32();
    if ((flags & ACK_FLAG) === 0 && ack !== 0) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 20);
    const batchIndex = reader.uint16();
    const batchCount = reader.uint16();
    if (batchCount === 0 || batchCount > V2_LIMITS.MAX_BATCHES || batchIndex >= batchCount)
        throw new ProtocolError(ProtocolErrorCode.BATCH_LIMIT, 24);
    const count = reader.uint16();
    if (count > V2_LIMITS.MAX_RECORDS_PER_FRAME) throw new ProtocolError(ProtocolErrorCode.RECORD_LIMIT, 28);
    if (reader.uint16() !== V3_SCHEMA_VERSION) throw new ProtocolError(ProtocolErrorCode.UNSUPPORTED_SCHEMA, 30);
    let localPlayerState: EntityState | undefined;
    if ((flags & LOCAL_PLAYER_FLAG) !== 0) {
        if (batchIndex !== 0) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 5);
        const local = readRecord(reader, true);
        if (local.kind !== "create" || local.state.prefab !== "DefaultPlayer")
            throw new ProtocolError(
                ProtocolErrorCode.INVALID_RECORD,
                V3_HEADER_BYTES,
                "local player must be a complete player",
            );
        localPlayerState = local.state;
    }
    const records: EntityRecord[] = [];
    const ids = new Set<string>();
    for (let index = 0; index < count; index++) {
        const offset = reader.offset;
        const record = readRecord(reader);
        const id = recordId(record);
        if (ids.has(id)) throw new ProtocolError(ProtocolErrorCode.DUPLICATE_ENTITY, offset, id);
        ids.add(id);
        records.push(record);
    }
    if (reader.offset !== buffer.byteLength)
        throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, reader.offset, "trailing bytes");
    return Object.freeze({
        serverTick,
        snapshotId,
        lastProcessedInputSeq: (flags & ACK_FLAG) === 0 ? null : ack,
        batchIndex,
        batchCount,
        records: Object.freeze(records),
        ...(localPlayerState === undefined ? {} : { localPlayerState }),
    });
}

/** Returns immutable DTOs only after validating every bounded, matching frame. */
export function decodeSnapshotV3(buffers: readonly ArrayBuffer[]): Snapshot {
    if (!Array.isArray(buffers) || buffers.length === 0 || buffers.length > V2_LIMITS.MAX_BATCHES)
        throw new ProtocolError(ProtocolErrorCode.BATCH_LIMIT);
    let totalBytes = 0;
    for (const buffer of buffers) {
        if (!(buffer instanceof ArrayBuffer)) throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE);
        totalBytes += buffer.byteLength;
        if (totalBytes > V2_LIMITS.MAX_SNAPSHOT_BYTES) throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT);
    }
    const frames = buffers.map(decodeFrameV3).sort((left, right) => left.batchIndex - right.batchIndex);
    const first = frames[0];
    if (!first || first.batchIndex !== 0 || first.batchCount !== frames.length)
        throw new ProtocolError(ProtocolErrorCode.BATCH_MISMATCH);
    const ids = new Set<string>();
    const records: EntityRecord[] = [];
    for (const [index, frame] of frames.entries()) {
        if (
            frame.batchIndex !== index ||
            frame.batchCount !== frames.length ||
            frame.serverTick !== first.serverTick ||
            frame.snapshotId !== first.snapshotId ||
            frame.lastProcessedInputSeq !== first.lastProcessedInputSeq
        )
            throw new ProtocolError(ProtocolErrorCode.BATCH_MISMATCH);
        for (const record of frame.records) {
            const id = recordId(record);
            if (ids.has(id)) throw new ProtocolError(ProtocolErrorCode.DUPLICATE_ENTITY, 0, id);
            ids.add(id);
            records.push(record);
            if (records.length > V2_LIMITS.MAX_SNAPSHOT_RECORDS)
                throw new ProtocolError(ProtocolErrorCode.RECORD_LIMIT);
        }
    }
    return Object.freeze({
        serverTick: first.serverTick,
        snapshotId: first.snapshotId,
        lastProcessedInputSeq: first.lastProcessedInputSeq,
        records: Object.freeze(records),
        ...(first.localPlayerState === undefined ? {} : { localPlayerState: first.localPlayerState }),
    });
}
