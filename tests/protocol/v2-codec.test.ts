import assert from "node:assert/strict";
import { test } from "node:test";
import {
    decodeFrame,
    decodeSnapshot,
    encodeSnapshot,
    ENTITY_SCHEMAS,
    EntityRecord,
    EntityState,
    ProtocolError,
    ProtocolErrorCode,
    V2_HEADER_BYTES,
    V2_LIMITS,
} from "../../shared/protocol";
import { entity, snapshot } from "./fixtures";

function singleFrame(records: readonly EntityRecord[]): ArrayBuffer {
    const frames = encodeSnapshot(snapshot(records));
    assert.equal(frames.length, 1);
    const frame = frames[0];
    assert.ok(frame);
    return frame;
}

function expectCode(callback: () => unknown, code: string): void {
    assert.throws(callback, (error: unknown) => error instanceof ProtocolError && error.code === code);
}

function fieldPayloadOffset(buffer: ArrayBuffer, fieldId: number): number {
    const view = new DataView(buffer);
    let offset = V2_HEADER_BYTES + 12;
    const fields = view.getUint16(V2_HEADER_BYTES + 10);
    for (let index = 0; index < fields; index++) {
        const id = view.getUint16(offset);
        const byteLength = view.getUint32(offset + 3);
        if (id === fieldId) return offset + 7;
        offset += 7 + byteLength;
    }
    throw new Error(`Missing fixture field ${fieldId}`);
}

test("protocol/v2: immutable explicit schemas do not depend on runtime classes or property order", () => {
    assert.equal(Object.isFrozen(ENTITY_SCHEMAS), true);
    for (const schema of Object.values(ENTITY_SCHEMAS)) {
        assert.equal(Object.isFrozen(schema), true);
        assert.equal(Object.isFrozen(schema.fields), true);
        assert.equal(new Set(schema.fields.map((field) => field.id)).size, schema.fields.length);
        assert.equal(schema.fields.every(Object.isFrozen), true);
    }
    const state = entity();
    const shuffled: EntityState = {
        ...state,
        fields: { spriteName: "wall", invisible: false, velocity: 0 },
        transform: { rotation: 0, scaleY: 32, y: 200.5, scaleX: 32, x: 100.25 },
    };
    assert.deepEqual(singleFrame([{ kind: "create", state }]), singleFrame([{ kind: "create", state: shuffled }]));
});

test("protocol/v2: hand-authored destroy frame freezes header and record bytes", () => {
    const frame = singleFrame([{ kind: "destroy", id: "C42" }]);
    assert.deepEqual(
        Array.from(new Uint8Array(frame)),
        [
            0x4e, 0x4d, 0x4d, 0x32, 2, 0, 0, 32, 0, 0, 0, 42, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0,
            1, 0, 0, 0, 10, 3, 0x43, 0, 0, 0, 42,
        ],
    );
    assert.deepEqual(decodeSnapshot([frame]), snapshot([{ kind: "destroy", id: "C42" }]));
});

test("protocol/v2: all prefabs round-trip complete UTF-8 state and true booleans", () => {
    const records: EntityRecord[] = Object.values(ENTITY_SCHEMAS).map((schema) => ({
        kind: "create",
        state: entity(schema.prefab),
    }));
    const source = {
        ...snapshot(records),
        serverTick: 0xffffffff,
        snapshotId: 0xffffffff,
        lastProcessedInputSeq: 0xffffffff,
        localPlayerState: entity("DefaultPlayer", 42),
    };
    const result = decodeSnapshot(encodeSnapshot(source));
    assert.deepEqual(result, source);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.records), true);
    assert.equal(Object.isFrozen(result.localPlayerState?.transform), true);
    for (const record of result.records) {
        if (record.kind !== "create") continue;
        assert.equal(typeof record.state.fields.invisible, "boolean");
        assert.equal(Object.isFrozen(record.state.fields), true);
    }
});

test("protocol/v2: update patches remain partial and destroy can share a frame with another entity", () => {
    const source = snapshot([
        {
            kind: "update",
            id: "A1",
            prefab: "DefaultPlayer",
            transform: { x: 123.5 },
            fields: { name: "Łódź 🎮", invisible: true },
        },
        { kind: "destroy", id: "C42" },
    ]);
    assert.deepEqual(decodeSnapshot(encodeSnapshot(source)), source);
});

test("protocol/v2: UTF-8 limits count bytes, preserve BOM and reject unpaired surrogates", () => {
    for (const name of ["", "ż".repeat(128), "🎮".repeat(64), "\uFEFFZażółć"]) {
        const source = snapshot([{ kind: "update", id: "A1", prefab: "DefaultPlayer", fields: { name } }]);
        assert.deepEqual(decodeSnapshot(encodeSnapshot(source)), source);
    }
    for (const name of ["ż".repeat(129), "🎮".repeat(65)]) {
        expectCode(
            () => encodeSnapshot(snapshot([{ kind: "update", id: "A1", prefab: "DefaultPlayer", fields: { name } }])),
            ProtocolErrorCode.STRING_LIMIT,
        );
    }
    expectCode(
        () =>
            encodeSnapshot(
                snapshot([{ kind: "update", id: "A1", prefab: "DefaultPlayer", fields: { name: "\uD800" } }]),
            ),
        ProtocolErrorCode.INVALID_UTF8,
    );
});

test("protocol/v2: every truncation of complete and delta frames fails with a typed error", () => {
    const frames = [
        singleFrame([{ kind: "create", state: entity("DefaultPlayer") }]),
        singleFrame([{ kind: "update", id: "C1", prefab: "Wall", transform: { x: 2 }, fields: { invisible: true } }]),
        singleFrame([{ kind: "destroy", id: "C1" }]),
    ];
    for (const frame of frames) {
        for (let length = 0; length < frame.byteLength; length++) {
            assert.throws(() => decodeSnapshot([frame.slice(0, length)]), ProtocolError, `truncated to ${length}`);
        }
    }
});

test("protocol/v2: malformed scalar, boolean, UTF-8 and field framing are rejected", () => {
    const wall = singleFrame([{ kind: "create", state: entity() }]);
    const nan = wall.slice(0);
    new DataView(nan).setFloat64(fieldPayloadOffset(nan, 1), NaN);
    expectCode(() => decodeSnapshot([nan]), ProtocolErrorCode.INVALID_VALUE);
    const bool = wall.slice(0);
    new DataView(bool).setUint8(fieldPayloadOffset(bool, 7), 2);
    expectCode(() => decodeSnapshot([bool]), ProtocolErrorCode.FIELD_TYPE);
    const string = wall.slice(0);
    new DataView(string).setUint8(fieldPayloadOffset(string, 8), 0xff);
    expectCode(() => decodeSnapshot([string]), ProtocolErrorCode.INVALID_UTF8);
    const unknown = wall.slice(0);
    new DataView(unknown).setUint16(V2_HEADER_BYTES + 12, 999);
    expectCode(() => decodeSnapshot([unknown]), ProtocolErrorCode.UNKNOWN_FIELD);
    const duplicate = wall.slice(0);
    new DataView(duplicate).setUint16(V2_HEADER_BYTES + 12 + 7 + 8, 1);
    expectCode(() => decodeSnapshot([duplicate]), ProtocolErrorCode.DUPLICATE_FIELD);
    const invalidRecord = wall.slice(0);
    new DataView(invalidRecord).setUint32(V2_HEADER_BYTES, 0);
    expectCode(() => decodeSnapshot([invalidRecord]), ProtocolErrorCode.INVALID_RECORD);
    const incomplete = singleFrame([{ kind: "update", id: "C1", prefab: "Wall", transform: { x: 1 } }]);
    new DataView(incomplete).setUint8(V2_HEADER_BYTES + 4, 1);
    expectCode(() => decodeSnapshot([incomplete]), ProtocolErrorCode.INCOMPLETE_CREATE);
});

test("protocol/v2: encoder rejects values its decoder cannot represent", () => {
    const invalid: EntityRecord[] = [
        { kind: "update", id: "C1", prefab: "Wall", fields: { invisible: 1 } },
        { kind: "update", id: "C1", prefab: "Wall", transform: { x: Infinity } },
        { kind: "update", id: "C1", prefab: "Wall", fields: { unknown: 1 } },
        { kind: "update", id: "C1", prefab: "Wall", fields: {} },
        { kind: "update", id: "A1", prefab: "Wall", transform: { x: 1 } },
        { kind: "destroy", id: "C4294967296" },
        { kind: "destroy", id: "C01" },
    ];
    for (const record of invalid) assert.throws(() => encodeSnapshot(snapshot([record])), ProtocolError);
    expectCode(
        () => encodeSnapshot({ ...snapshot(), localPlayerState: entity("Wall") }),
        ProtocolErrorCode.INVALID_RECORD,
    );
    const missing = { ...entity(), fields: { velocity: 0, invisible: false } };
    expectCode(
        () => encodeSnapshot(snapshot([{ kind: "create", state: missing }])),
        ProtocolErrorCode.INCOMPLETE_CREATE,
    );
});

test("protocol/v2: batching is bounded, accepts out-of-order frames and validates the entire snapshot atomically", () => {
    const records: EntityRecord[] = Array.from({ length: 4097 }, (_, id) => ({
        kind: "create",
        state: entity("Wall", id),
    }));
    const source = { ...snapshot(records), localPlayerState: entity("DefaultPlayer", 99), lastProcessedInputSeq: 5 };
    const frames = encodeSnapshot(source);
    assert.ok(frames.length > 1);
    for (const [index, frame] of frames.entries()) {
        assert.ok(frame.byteLength <= V2_LIMITS.MAX_FRAME_BYTES);
        const decoded = decodeFrame(frame);
        assert.equal(decoded.batchIndex, index);
        assert.equal(decoded.batchCount, frames.length);
        assert.ok(decoded.records.length <= V2_LIMITS.MAX_RECORDS_PER_FRAME);
        assert.equal(decoded.localPlayerState === undefined, index !== 0);
    }
    assert.deepEqual(decodeSnapshot([...frames].reverse()), source);
    expectCode(() => decodeSnapshot(frames.slice(1)), ProtocolErrorCode.BATCH_MISMATCH);
    expectCode(() => decodeSnapshot([frames[0]!, ...frames.slice(0, -1)]), ProtocolErrorCode.BATCH_MISMATCH);

    const corrupt = frames.map((frame) => frame.slice(0));
    new DataView(corrupt[corrupt.length - 1]!).setUint32(16, 7);
    let publishedRecords = 0;
    const apply = () => {
        const validated = decodeSnapshot(corrupt);
        publishedRecords += validated.records.length;
    };
    expectCode(apply, ProtocolErrorCode.BATCH_MISMATCH);
    assert.equal(publishedRecords, 0, "no valid prefix is handed to an apply step");
});

test("protocol/v2: record, frame, batch and duplicate-entity limits are symmetric", () => {
    const tooMany = Array.from(
        { length: V2_LIMITS.MAX_SNAPSHOT_RECORDS + 1 },
        (_, id) => ({ kind: "destroy", id: `C${id}` }) as const,
    );
    expectCode(() => encodeSnapshot(snapshot(tooMany)), ProtocolErrorCode.RECORD_LIMIT);
    expectCode(
        () => decodeSnapshot(Array.from({ length: V2_LIMITS.MAX_BATCHES + 1 }, () => new ArrayBuffer(0))),
        ProtocolErrorCode.BATCH_LIMIT,
    );
    expectCode(() => decodeFrame(new ArrayBuffer(V2_LIMITS.MAX_FRAME_BYTES + 1)), ProtocolErrorCode.FRAME_LIMIT);
    const duplicate = { kind: "destroy", id: "C1" } as const;
    expectCode(() => encodeSnapshot(snapshot([duplicate, duplicate])), ProtocolErrorCode.DUPLICATE_ENTITY);

    const frame = singleFrame([duplicate]);
    new DataView(frame).setUint16(28, V2_LIMITS.MAX_RECORDS_PER_FRAME + 1);
    expectCode(() => decodeSnapshot([frame]), ProtocolErrorCode.RECORD_LIMIT);
});

test("protocol/v2: long actor state splits on byte size and enforces a total snapshot budget", () => {
    const player = entity("DefaultPlayer");
    const largeState: EntityState = {
        ...player,
        fields: { ...player.fields, spriteName: "s".repeat(128), name: "🎮".repeat(64), animationType: "a".repeat(64) },
    };
    const create = (id: number): EntityRecord => ({ kind: "create", state: { ...largeState, id: `A${id}` } });
    const records = Array.from({ length: 200 }, (_, id) => create(id));
    const frames = encodeSnapshot(snapshot(records));
    assert.ok(frames.length > 1, "byte limit splits before reaching 256 records");
    for (const frame of frames) {
        assert.ok(frame.byteLength <= V2_LIMITS.MAX_FRAME_BYTES);
        assert.ok(decodeFrame(frame).records.length < V2_LIMITS.MAX_RECORDS_PER_FRAME);
    }
    assert.deepEqual(decodeSnapshot(frames), snapshot(records));
    const oversized = Array.from({ length: 14000 }, (_, id) => create(id));
    expectCode(() => encodeSnapshot(snapshot(oversized)), ProtocolErrorCode.FRAME_LIMIT);
    expectCode(
        () => decodeSnapshot(Array.from({ length: 129 }, () => new ArrayBuffer(V2_LIMITS.MAX_FRAME_BYTES))),
        ProtocolErrorCode.FRAME_LIMIT,
    );
});

test("protocol/v2: deterministic malformed-frame fuzzing never leaks native parser errors", () => {
    let seed = 0x12345678;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
    };
    const valid = singleFrame([{ kind: "create", state: entity("DefaultPlayer") }]);
    for (let iteration = 0; iteration < 1000; iteration++) {
        const bytes = iteration % 2 === 0 ? new Uint8Array(valid.slice(0)) : new Uint8Array(random() % 512);
        const mutations = iteration % 2 === 0 ? 1 + (random() % 4) : bytes.length;
        for (let index = 0; index < mutations; index++) {
            if (bytes.length > 0) bytes[random() % bytes.length] = random() & 0xff;
        }
        try {
            const decoded = decodeSnapshot([bytes.buffer]);
            assert.deepEqual(decodeSnapshot(encodeSnapshot(decoded)), decoded);
        } catch (error) {
            assert.ok(error instanceof ProtocolError, `iteration ${iteration}: ${String(error)}`);
        }
    }
});
