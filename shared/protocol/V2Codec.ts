import { ProtocolError, ProtocolErrorCode } from "./ProtocolError";
import { ENTITY_SCHEMAS, FIELD_TYPE_IDS, SCHEMAS_BY_WIRE_ID, V2_LIMITS } from "./Schema";
import type { EntitySchema, FieldSchema } from "./Schema";
import { requireUint32 } from "./Sequence";
import { isEntityId } from "./EntityId";
import type {
    DecodedFrame,
    EntityFields,
    EntityRecord,
    EntityState,
    FieldValue,
    PrefabName,
    Snapshot,
    TransformState,
} from "./Types";

export const PROTOCOL_V2 = 2;
export const V2_SCHEMA_VERSION = 1;
export const V2_HEADER_BYTES = 32;
export const V2_MAGIC = 0x4e4d4d32; // NMM2, network byte order.

const ACK_FLAG = 1;
const LOCAL_PLAYER_FLAG = 2;
const RECORD_HEADER_BYTES = 10;
const FIELD_HEADER_BYTES = 7;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const own = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

interface SelectedField {
    readonly schema: FieldSchema;
    readonly value: FieldValue;
    readonly bytes: number;
    readonly utf8?: Uint8Array;
}

function requireObject(value: unknown, name: string, offset: number = 0): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, offset, `${name} must be an object`);
    }
    return value as Record<string, unknown>;
}

function schemaForPrefab(prefab: unknown, offset: number = 0): EntitySchema {
    if (typeof prefab !== "string" || !own(ENTITY_SCHEMAS, prefab)) {
        throw new ProtocolError(ProtocolErrorCode.UNKNOWN_PREFAB, offset);
    }
    return ENTITY_SCHEMAS[prefab as PrefabName];
}

function entityId(id: unknown, schema?: EntitySchema, offset: number = 0): { schema: EntitySchema; sequence: number } {
    if (!isEntityId(id)) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_ID, offset);
    }
    const idSchema = SCHEMAS_BY_WIRE_ID[id.charCodeAt(0)];
    const sequence = Number(id.slice(1));
    if (!idSchema || sequence > 0xffffffff || (schema && idSchema !== schema)) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_ID, offset, "prefab and ID prefix must agree");
    }
    return { schema: idSchema, sequence };
}

function validateField(schema: FieldSchema, value: unknown, offset: number = 0): FieldValue {
    if (schema.type === "string") {
        if (typeof value !== "string") {
            throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, offset, schema.name);
        }
        if (value.length > (schema.maxBytes ?? V2_LIMITS.MAX_STRING_BYTES)) {
            throw new ProtocolError(ProtocolErrorCode.STRING_LIMIT, offset, schema.name);
        }
        // TextEncoder replaces lone UTF-16 surrogates. Reject them to preserve a
        // lossless round trip rather than silently changing a caller's string.
        for (let index = 0; index < value.length; index++) {
            const unit = value.charCodeAt(index);
            if (unit >= 0xd800 && unit <= 0xdbff) {
                const low = value.charCodeAt(++index);
                if (!(low >= 0xdc00 && low <= 0xdfff)) {
                    throw new ProtocolError(ProtocolErrorCode.INVALID_UTF8, offset, "unpaired surrogate");
                }
            } else if (unit >= 0xdc00 && unit <= 0xdfff) {
                throw new ProtocolError(ProtocolErrorCode.INVALID_UTF8, offset, "unpaired surrogate");
            }
        }
        return value;
    }
    if (schema.type === "bool") {
        if (typeof value !== "boolean") {
            throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, offset, schema.name);
        }
        return value;
    }
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (schema.type === "uint16" && (!Number.isInteger(value) || value < 0 || value > 0xffff)) ||
        (schema.min !== undefined && value < schema.min) ||
        (schema.max !== undefined && value > schema.max)
    ) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, offset, schema.name);
    }
    return value;
}

function selectFields(schema: EntitySchema, transform: unknown, fields: unknown, complete: boolean): SelectedField[] {
    const transformObject = transform === undefined ? {} : requireObject(transform, "transform");
    const fieldsObject = fields === undefined ? {} : requireObject(fields, "fields");
    for (const [section, values] of [
        ["transform", transformObject],
        ["fields", fieldsObject],
    ] as const) {
        for (const name of Object.keys(values)) {
            if (!schema.fields.some((field) => field.section === section && field.name === name)) {
                throw new ProtocolError(ProtocolErrorCode.UNKNOWN_FIELD, 0, `${schema.prefab}.${name}`);
            }
        }
    }

    const selected: SelectedField[] = [];
    for (const field of schema.fields) {
        const values = field.section === "transform" ? transformObject : fieldsObject;
        if (!own(values, field.name)) {
            if (complete) {
                throw new ProtocolError(ProtocolErrorCode.INCOMPLETE_CREATE, 0, field.name);
            }
            continue;
        }
        const value = validateField(field, values[field.name]);
        if (field.type === "string") {
            const utf8 = textEncoder.encode(value as string);
            if (utf8.byteLength > (field.maxBytes ?? V2_LIMITS.MAX_STRING_BYTES)) {
                throw new ProtocolError(ProtocolErrorCode.STRING_LIMIT, 0, field.name);
            }
            selected.push({ schema: field, value, utf8, bytes: utf8.byteLength });
        } else {
            selected.push({
                schema: field,
                value,
                bytes: field.type === "float64" ? 8 : field.type === "uint16" ? 2 : 1,
            });
        }
    }
    if (!complete && selected.length === 0) {
        throw new ProtocolError(ProtocolErrorCode.EMPTY_UPDATE);
    }
    return selected;
}

function writeRecord(record: EntityRecord): Uint8Array {
    requireObject(record, "record");
    let schema: EntitySchema;
    let id: unknown;
    let fields: SelectedField[] = [];
    let kind: number;
    if (record.kind === "destroy") {
        const parsed = entityId(record.id);
        schema = parsed.schema;
        id = record.id;
        kind = 3;
    } else if (record.kind === "create") {
        requireObject(record.state, "state");
        schema = schemaForPrefab(record.state.prefab);
        id = record.state.id;
        fields = selectFields(schema, record.state.transform, record.state.fields, true);
        kind = 1;
    } else if (record.kind === "update") {
        schema = schemaForPrefab(record.prefab);
        id = record.id;
        fields = selectFields(schema, record.transform, record.fields, false);
        kind = 2;
    } else {
        throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD);
    }
    const parsed = entityId(id, schema);
    const byteLength =
        RECORD_HEADER_BYTES +
        (kind === 3 ? 0 : 2) +
        fields.reduce((sum, field) => sum + FIELD_HEADER_BYTES + field.bytes, 0);
    if (byteLength + V2_HEADER_BYTES > V2_LIMITS.MAX_FRAME_BYTES) {
        throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT, 0, "a single record exceeds the frame limit");
    }
    const bytes = new Uint8Array(byteLength);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, byteLength);
    view.setUint8(4, kind);
    view.setUint8(5, schema.wireId);
    view.setUint32(6, parsed.sequence);
    if (kind === 3) return bytes;
    view.setUint16(10, fields.length);
    let offset = 12;
    for (const field of fields) {
        view.setUint16(offset, field.schema.id);
        view.setUint8(offset + 2, FIELD_TYPE_IDS[field.schema.type]);
        view.setUint32(offset + 3, field.bytes);
        offset += FIELD_HEADER_BYTES;
        switch (field.schema.type) {
            case "float64":
                view.setFloat64(offset, field.value as number);
                break;
            case "uint16":
                view.setUint16(offset, field.value as number);
                break;
            case "bool":
                view.setUint8(offset, field.value === true ? 1 : 0);
                break;
            case "string":
                bytes.set(field.utf8 ?? new Uint8Array(), offset);
                break;
        }
        offset += field.bytes;
    }
    return bytes;
}

function recordId(record: EntityRecord): string {
    return record.kind === "create" ? record.state.id : record.id;
}

/** Encodes one atomic snapshot into bounded transport frames. No domain state is mutated. */
export function encodeSnapshot(snapshot: Snapshot): readonly ArrayBuffer[] {
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
            : writeRecord({ kind: "create", state: snapshot.localPlayerState });
    let current: Uint8Array[] = [];
    const groups: Uint8Array[][] = [current];
    let currentSize = V2_HEADER_BYTES + (local?.byteLength ?? 0);
    let totalBytes = currentSize;
    const ids = new Set<string>();
    for (const record of snapshot.records) {
        const bytes = writeRecord(record);
        const id = recordId(record);
        if (ids.has(id)) throw new ProtocolError(ProtocolErrorCode.DUPLICATE_ENTITY, 0, id);
        ids.add(id);
        if (
            current.length >= V2_LIMITS.MAX_RECORDS_PER_FRAME ||
            currentSize + bytes.byteLength > V2_LIMITS.MAX_FRAME_BYTES
        ) {
            current = [];
            groups.push(current);
            currentSize = V2_HEADER_BYTES;
            totalBytes += V2_HEADER_BYTES;
        }
        current.push(bytes);
        currentSize += bytes.byteLength;
        totalBytes += bytes.byteLength;
        if (groups.length > V2_LIMITS.MAX_BATCHES) throw new ProtocolError(ProtocolErrorCode.BATCH_LIMIT);
        if (totalBytes > V2_LIMITS.MAX_SNAPSHOT_BYTES) throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT);
    }

    return Object.freeze(
        groups.map((records, batchIndex) => {
            const localRecord = batchIndex === 0 ? local : undefined;
            const frameLength =
                V2_HEADER_BYTES +
                (localRecord?.byteLength ?? 0) +
                records.reduce((sum, record) => sum + record.byteLength, 0);
            const frame = new ArrayBuffer(frameLength);
            const view = new DataView(frame);
            view.setUint32(0, V2_MAGIC);
            view.setUint8(4, PROTOCOL_V2);
            view.setUint8(5, (ack === null ? 0 : ACK_FLAG) | (localRecord === undefined ? 0 : LOCAL_PLAYER_FLAG));
            view.setUint16(6, V2_HEADER_BYTES);
            view.setUint32(8, frameLength);
            view.setUint32(12, serverTick);
            view.setUint32(16, snapshotId);
            view.setUint32(20, ack ?? 0);
            view.setUint16(24, batchIndex);
            view.setUint16(26, groups.length);
            view.setUint16(28, records.length);
            view.setUint16(30, V2_SCHEMA_VERSION);
            const bytes = new Uint8Array(frame);
            let offset = V2_HEADER_BYTES;
            if (localRecord) {
                bytes.set(localRecord, offset);
                offset += localRecord.byteLength;
            }
            for (const record of records) {
                bytes.set(record, offset);
                offset += record.byteLength;
            }
            return frame;
        }),
    );
}

class Reader {
    readonly view: DataView;
    offset = 0;

    constructor(readonly buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
    }

    require(length: number, end: number = this.view.byteLength): void {
        if (!Number.isSafeInteger(length) || length < 0 || this.offset + length > end) {
            throw new ProtocolError(ProtocolErrorCode.TRUNCATED, this.offset);
        }
    }

    uint8(end?: number): number {
        this.require(1, end);
        return this.view.getUint8(this.offset++);
    }

    uint16(end?: number): number {
        this.require(2, end);
        const value = this.view.getUint16(this.offset);
        this.offset += 2;
        return value;
    }

    uint32(end?: number): number {
        this.require(4, end);
        const value = this.view.getUint32(this.offset);
        this.offset += 4;
        return value;
    }
}

function readRecord(reader: Reader): EntityRecord {
    const start = reader.offset;
    const length = reader.uint32();
    if (length < RECORD_HEADER_BYTES) throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, start);
    reader.require(length - 4);
    const end = start + length;
    const kind = reader.uint8(end);
    const prefabOffset = reader.offset;
    const schema = SCHEMAS_BY_WIRE_ID[reader.uint8(end)];
    if (!schema) throw new ProtocolError(ProtocolErrorCode.UNKNOWN_PREFAB, prefabOffset);
    const sequence = reader.uint32(end);
    const id = schema.idPrefix + sequence.toString();
    if (kind === 3) {
        if (reader.offset !== end) throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, reader.offset);
        return Object.freeze({ kind: "destroy", id });
    }
    if (kind !== 1 && kind !== 2) throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, start + 4);
    const count = reader.uint16(end);
    if (count === 0 || count > schema.fields.length) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, start + 10);
    }
    const selected = new Set<number>();
    const fields: Record<string, FieldValue> = {};
    const transform: Record<string, number> = {};
    for (let index = 0; index < count; index++) {
        const fieldOffset = reader.offset;
        const fieldId = reader.uint16(end);
        const field = schema.fields.find((candidate) => candidate.id === fieldId);
        if (!field) throw new ProtocolError(ProtocolErrorCode.UNKNOWN_FIELD, fieldOffset);
        if (selected.has(fieldId)) throw new ProtocolError(ProtocolErrorCode.DUPLICATE_FIELD, fieldOffset);
        selected.add(fieldId);
        const type = reader.uint8(end);
        if (type !== FIELD_TYPE_IDS[field.type]) throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, fieldOffset + 2);
        const byteLength = reader.uint32(end);
        const payloadOffset = reader.offset;
        reader.require(byteLength, end);
        let value: FieldValue;
        if (field.type === "string") {
            if (byteLength > (field.maxBytes ?? V2_LIMITS.MAX_STRING_BYTES)) {
                throw new ProtocolError(ProtocolErrorCode.STRING_LIMIT, payloadOffset);
            }
            try {
                value = textDecoder.decode(new Uint8Array(reader.buffer, payloadOffset, byteLength));
            } catch {
                throw new ProtocolError(ProtocolErrorCode.INVALID_UTF8, payloadOffset);
            }
        } else {
            const expectedLength = field.type === "float64" ? 8 : field.type === "uint16" ? 2 : 1;
            if (byteLength !== expectedLength) throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, payloadOffset);
            if (field.type === "float64") {
                value = reader.view.getFloat64(payloadOffset);
            } else if (field.type === "uint16") {
                value = reader.view.getUint16(payloadOffset);
            } else {
                const bool = reader.view.getUint8(payloadOffset);
                if (bool !== 0 && bool !== 1) throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, payloadOffset);
                value = bool === 1;
            }
        }
        validateField(field, value, payloadOffset);
        if (field.section === "transform") {
            transform[field.name] = value as number;
        } else {
            fields[field.name] = value;
        }
        reader.offset += byteLength;
    }
    if (reader.offset !== end) throw new ProtocolError(ProtocolErrorCode.INVALID_RECORD, reader.offset);
    if (kind === 1) {
        if (selected.size !== schema.fields.length) throw new ProtocolError(ProtocolErrorCode.INCOMPLETE_CREATE, start);
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

/** Diagnostic single-frame decode. Apply only after decodeSnapshot validates all batches. */
export function decodeFrame(buffer: ArrayBuffer): DecodedFrame {
    if (!(buffer instanceof ArrayBuffer)) throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE);
    if (buffer.byteLength > V2_LIMITS.MAX_FRAME_BYTES) throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT);
    const reader = new Reader(buffer);
    reader.require(V2_HEADER_BYTES);
    if (reader.uint32() !== V2_MAGIC) throw new ProtocolError(ProtocolErrorCode.BAD_MAGIC, 0);
    if (reader.uint8() !== PROTOCOL_V2) throw new ProtocolError(ProtocolErrorCode.UNSUPPORTED_VERSION, 4);
    const flags = reader.uint8();
    if ((flags & ~(ACK_FLAG | LOCAL_PLAYER_FLAG)) !== 0) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 5);
    if (reader.uint16() !== V2_HEADER_BYTES) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 6);
    if (reader.uint32() !== buffer.byteLength) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 8);
    const serverTick = reader.uint32();
    const snapshotId = reader.uint32();
    const ack = reader.uint32();
    if ((flags & ACK_FLAG) === 0 && ack !== 0) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 20);
    const batchIndex = reader.uint16();
    const batchCount = reader.uint16();
    if (batchCount === 0 || batchCount > V2_LIMITS.MAX_BATCHES || batchIndex >= batchCount) {
        throw new ProtocolError(ProtocolErrorCode.BATCH_LIMIT, 24);
    }
    const count = reader.uint16();
    if (count > V2_LIMITS.MAX_RECORDS_PER_FRAME) throw new ProtocolError(ProtocolErrorCode.RECORD_LIMIT, 28);
    if (reader.uint16() !== V2_SCHEMA_VERSION) throw new ProtocolError(ProtocolErrorCode.UNSUPPORTED_SCHEMA, 30);
    let localPlayerState: EntityState | undefined;
    if ((flags & LOCAL_PLAYER_FLAG) !== 0) {
        if (batchIndex !== 0) throw new ProtocolError(ProtocolErrorCode.INVALID_HEADER, 5);
        const local = readRecord(reader);
        if (local.kind !== "create" || local.state.prefab !== "DefaultPlayer") {
            throw new ProtocolError(
                ProtocolErrorCode.INVALID_RECORD,
                V2_HEADER_BYTES,
                "local player must be a complete player",
            );
        }
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

/** Validates every frame and the complete batch set before returning immutable DTOs. */
export function decodeSnapshot(buffers: readonly ArrayBuffer[]): Snapshot {
    if (!Array.isArray(buffers) || buffers.length === 0 || buffers.length > V2_LIMITS.MAX_BATCHES) {
        throw new ProtocolError(ProtocolErrorCode.BATCH_LIMIT);
    }
    let totalBytes = 0;
    for (const buffer of buffers) {
        if (!(buffer instanceof ArrayBuffer)) throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE);
        totalBytes += buffer.byteLength;
        if (totalBytes > V2_LIMITS.MAX_SNAPSHOT_BYTES) throw new ProtocolError(ProtocolErrorCode.FRAME_LIMIT);
    }
    const frames = buffers.map(decodeFrame).sort((left, right) => left.batchIndex - right.batchIndex);
    const first = frames[0];
    if (!first || first.batchIndex !== 0 || first.batchCount !== frames.length) {
        throw new ProtocolError(ProtocolErrorCode.BATCH_MISMATCH);
    }
    const ids = new Set<string>();
    const records: EntityRecord[] = [];
    for (const [index, frame] of frames.entries()) {
        if (
            frame.batchIndex !== index ||
            frame.batchCount !== frames.length ||
            frame.serverTick !== first.serverTick ||
            frame.snapshotId !== first.snapshotId ||
            frame.lastProcessedInputSeq !== first.lastProcessedInputSeq
        ) {
            throw new ProtocolError(ProtocolErrorCode.BATCH_MISMATCH);
        }
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
