import assert from "node:assert/strict";
import { test } from "node:test";
import {
    decodeFrameV3,
    decodeSnapshotV3,
    encodeSnapshotV3,
    encodeSnapshot,
    ENTITY_SCHEMAS,
    ProtocolError,
    ProtocolErrorCode,
    V3_HEADER_BYTES,
    V2_LIMITS,
} from "../../shared/protocol";
import type { EntityRecord, EntityState } from "../../shared/protocol";
import { entity, snapshot } from "./fixtures";

function frame(records: readonly EntityRecord[]): ArrayBuffer {
    const frames = encodeSnapshotV3(snapshot(records));
    assert.equal(frames.length, 1);
    return frames[0]!;
}

function expectCode(callback: () => unknown, code: string): void {
    assert.throws(callback, (error: unknown) => error instanceof ProtocolError && error.code === code);
}

function frameWithPayload(payload: readonly number[], count = 1): ArrayBuffer {
    const source = frame([]);
    const buffer = new ArrayBuffer(V3_HEADER_BYTES + payload.length);
    new Uint8Array(buffer).set(new Uint8Array(source));
    new Uint8Array(buffer).set(payload, V3_HEADER_BYTES);
    new DataView(buffer).setUint32(8, buffer.byteLength);
    new DataView(buffer).setUint16(28, count);
    return buffer;
}

test("protocol/v3: hand-authored destroy freezes compact prefab/kind tag and canonical ID varint", () => {
    const encoded = frame([{ kind: "destroy", id: "C42" }]);
    assert.deepEqual(
        Array.from(new Uint8Array(encoded)),
        [
            0x4e, 0x4d, 0x4d, 0x33, 3, 0, 0, 32, 0, 0, 0, 34, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0,
            1, 0x82, 42,
        ],
    );
    assert.deepEqual(decodeSnapshotV3([encoded]), snapshot([{ kind: "destroy", id: "C42" }]));
    assert.deepEqual(
        Array.from(new Uint8Array(frame([{ kind: "destroy", id: "I4294967295" }])).slice(32)),
        [0x88, 255, 255, 255, 255, 15],
    );
});

test("protocol/v3: explicit field IDs determine mask bits and payload order", () => {
    const first = frame([
        { kind: "update", id: "A1", prefab: "DefaultPlayer", transform: { y: 2, x: 1 }, fields: { vertical: -1 } },
    ]);
    const reordered = frame([
        { kind: "update", id: "A1", prefab: "DefaultPlayer", fields: { vertical: -1 }, transform: { x: 1, y: 2 } },
    ]);
    assert.deepEqual(first, reordered);
    assert.deepEqual(Array.from(new Uint8Array(first).slice(32)), [
        0x40,
        1,
        0x83,
        0x80,
        0x40, // bits for IDs 1, 2 and 21
        0x3f,
        0x80,
        0,
        0,
        0x40,
        0,
        0,
        0,
        0xbf,
        0x80,
        0,
        0,
    ]);
    assert.deepEqual(
        decodeSnapshotV3([first]),
        snapshot([
            { kind: "update", id: "A1", prefab: "DefaultPlayer", transform: { x: 1, y: 2 }, fields: { vertical: -1 } },
        ]),
    );
});

test("protocol/v3: complete states, UTF-8 and every prefab round-trip immutably", () => {
    const source = {
        ...snapshot(Object.values(ENTITY_SCHEMAS).map((schema) => ({ kind: "create", state: entity(schema.prefab) }))),
        serverTick: 0xffffffff,
        snapshotId: 0xffffffff,
        lastProcessedInputSeq: 0xffffffff,
        localPlayerState: entity("DefaultPlayer", 42),
    };
    const result = decodeSnapshotV3(encodeSnapshotV3(source));
    assert.deepEqual(result, source);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.records));
    assert.ok(Object.isFrozen(result.localPlayerState?.transform));
    for (const record of result.records) {
        if (record.kind !== "create") continue;
        assert.ok(Object.isFrozen(record.state.fields));
        assert.equal(typeof record.state.fields.invisible, "boolean");
    }
});

test("protocol/v3: authoritative local player retains all float64 bits independently of remote quantization", () => {
    const base = entity("DefaultPlayer");
    const local: EntityState = {
        ...base,
        transform: {
            x: 640.1234567890123,
            y: -0.00000000123456789,
            scaleX: 32.123456789,
            scaleY: 32.987654321,
            rotation: Math.PI,
        },
        fields: { ...base.fields, velocity: 0.123456789, horizontal: Math.SQRT1_2, vertical: -Math.SQRT1_2 },
    };
    const source = {
        ...snapshot([{ kind: "create", state: local }]),
        localPlayerState: local,
        lastProcessedInputSeq: 0,
    };
    const result = decodeSnapshotV3(encodeSnapshotV3(source));
    assert.deepEqual(result.localPlayerState, local, "reconciliation receives exact simulation state");
    const remote = result.records[0];
    assert.equal(remote?.kind, "create");
    if (remote?.kind !== "create") return;
    assert.equal(remote.state.transform.x, Math.fround(local.transform.x));
    assert.equal(remote.state.fields.velocity, Math.fround(local.fields.velocity as number));
    assert.notEqual(remote.state.transform.x, local.transform.x);
});

test("protocol/v3: remote position precision stays below 1/32 pixel across the supported million-pixel bounds", () => {
    for (const x of [
        -1_000_000, -999_999.97, -100_000.123, -640.12345, -0, 0.00000001, 640.12345, 8192.123, 999_999.97, 1_000_000,
    ]) {
        const result = decodeSnapshotV3([frame([{ kind: "update", id: "B1", prefab: "Michau", transform: { x } }])]);
        const record = result.records[0];
        assert.ok(record?.kind === "update");
        assert.ok(Math.abs(record.transform!.x! - x) <= 1 / 32);
        assert.ok(Object.is(record.transform!.x, Math.fround(x)), `float32 ${x}`);
    }
    // A v2-only rotation outside finite float32 cannot produce an undecodable v3 frame.
    expectCode(
        () => frame([{ kind: "update", id: "B1", prefab: "Michau", transform: { rotation: Number.MAX_VALUE } }]),
        ProtocolErrorCode.INVALID_VALUE,
    );
});

test("protocol/v3: canonical varints reject overflow, overlong encodings and unknown schema mask bits", () => {
    for (const payload of [
        [0x82, 0x80, 0],
        [0x82, 255, 255, 255, 255, 16],
        [0x82, 128, 128, 128, 128, 128, 0],
        [0x42, 1, 0x80, 0x02], // absent field ID 9
        [0x42, 1, 0x80, 0x80, 0x80, 0x80, 0x80],
        [0xc2, 1],
        [0xbf, 1],
    ])
        assert.throws(() => decodeSnapshotV3([frameWithPayload(payload)]), ProtocolError);
    expectCode(() => decodeSnapshotV3([frameWithPayload([0x42, 1, 0])]), ProtocolErrorCode.EMPTY_UPDATE);
    expectCode(
        () => decodeSnapshotV3([frameWithPayload([0x02, 1, 1, 0, 0, 0, 0])]),
        ProtocolErrorCode.INCOMPLETE_CREATE,
    );
});

test("protocol/v3: malformed scalars, booleans, UTF-8, extra payload and truncation use typed errors", () => {
    expectCode(
        () => decodeSnapshotV3([frameWithPayload([0x42, 1, 1, 0x7f, 0x80, 0, 0])]),
        ProtocolErrorCode.INVALID_VALUE,
    );
    expectCode(() => decodeSnapshotV3([frameWithPayload([0x42, 1, 64, 2])]), ProtocolErrorCode.FIELD_TYPE);
    expectCode(() => decodeSnapshotV3([frameWithPayload([0x42, 1, 128, 1, 1, 0xff])]), ProtocolErrorCode.INVALID_UTF8);
    expectCode(() => decodeSnapshotV3([frameWithPayload([0x82, 1, 0])]), ProtocolErrorCode.INVALID_RECORD);
    for (const encoded of [
        frame([{ kind: "create", state: entity("DefaultPlayer") }]),
        frame([{ kind: "update", id: "C1", prefab: "Wall", transform: { x: 2 }, fields: { invisible: true } }]),
        frame([{ kind: "destroy", id: "C1" }]),
    ]) {
        for (let length = 0; length < encoded.byteLength; length++)
            assert.throws(() => decodeSnapshotV3([encoded.slice(0, length)]), ProtocolError);
    }
});

test("protocol/v3: input validation remains symmetric for UTF-8 limits, unknown fields and IDs", () => {
    for (const name of ["", "ż".repeat(128), "🎮".repeat(64), "\uFEFFZażółć"]) {
        const source = snapshot([{ kind: "update", id: "A1", prefab: "DefaultPlayer", fields: { name } }]);
        assert.deepEqual(decodeSnapshotV3(encodeSnapshotV3(source)), source);
    }
    for (const name of ["ż".repeat(129), "🎮".repeat(65)])
        expectCode(
            () => frame([{ kind: "update", id: "A1", prefab: "DefaultPlayer", fields: { name } }]),
            ProtocolErrorCode.STRING_LIMIT,
        );
    expectCode(
        () => frame([{ kind: "update", id: "A1", prefab: "DefaultPlayer", fields: { name: "\uD800" } }]),
        ProtocolErrorCode.INVALID_UTF8,
    );
    for (const invalid of [
        { kind: "destroy", id: "C01" },
        { kind: "destroy", id: "C4294967296" },
        { kind: "update", id: "A1", prefab: "Wall", transform: { x: 1 } },
        { kind: "update", id: "C1", prefab: "Wall", fields: { unknown: 1 } },
        { kind: "update", id: "C1", prefab: "Wall", fields: {} },
    ] as EntityRecord[])
        assert.throws(() => frame([invalid]), ProtocolError);
    expectCode(
        () => encodeSnapshotV3({ ...snapshot(), localPlayerState: entity("Wall") }),
        ProtocolErrorCode.INVALID_RECORD,
    );
});

test("protocol/v3: batching preserves local precision and atomically rejects missing, duplicated or mixed frames", () => {
    const records: EntityRecord[] = Array.from({ length: 4097 }, (_, id) => ({
        kind: "create",
        state: entity("Wall", id),
    }));
    const source = { ...snapshot(records), localPlayerState: entity("DefaultPlayer", 99), lastProcessedInputSeq: 5 };
    const frames = encodeSnapshotV3(source);
    assert.ok(frames.length > 1);
    for (const [index, encoded] of frames.entries()) {
        assert.ok(encoded.byteLength <= V2_LIMITS.MAX_FRAME_BYTES);
        const decoded = decodeFrameV3(encoded);
        assert.equal(decoded.batchIndex, index);
        assert.equal(decoded.batchCount, frames.length);
        assert.ok(decoded.records.length <= V2_LIMITS.MAX_RECORDS_PER_FRAME);
        assert.equal(decoded.localPlayerState === undefined, index !== 0);
    }
    assert.deepEqual(decodeSnapshotV3([...frames].reverse()), source);
    expectCode(() => decodeSnapshotV3(frames.slice(1)), ProtocolErrorCode.BATCH_MISMATCH);
    expectCode(() => decodeSnapshotV3([frames[0]!, ...frames.slice(0, -1)]), ProtocolErrorCode.BATCH_MISMATCH);
    const mixed = frames.map((encoded) => encoded.slice(0));
    new DataView(mixed[mixed.length - 1]!).setUint32(16, 7);
    let published = 0;
    expectCode(() => {
        const result = decodeSnapshotV3(mixed);
        published += result.records.length;
    }, ProtocolErrorCode.BATCH_MISMATCH);
    assert.equal(published, 0);
});

test("protocol/v3: frame, snapshot, record and duplicate limits remain bounded", () => {
    expectCode(() => decodeFrameV3(new ArrayBuffer(V2_LIMITS.MAX_FRAME_BYTES + 1)), ProtocolErrorCode.FRAME_LIMIT);
    expectCode(() => decodeSnapshotV3([]), ProtocolErrorCode.BATCH_LIMIT);
    expectCode(
        () => decodeSnapshotV3(Array.from({ length: 257 }, () => new ArrayBuffer(0))),
        ProtocolErrorCode.BATCH_LIMIT,
    );
    expectCode(
        () => decodeSnapshotV3(Array.from({ length: 129 }, () => new ArrayBuffer(V2_LIMITS.MAX_FRAME_BYTES))),
        ProtocolErrorCode.FRAME_LIMIT,
    );
    expectCode(
        () => encodeSnapshotV3(snapshot(Array.from({ length: 65537 }, (_, id) => ({ kind: "destroy", id: `C${id}` })))),
        ProtocolErrorCode.RECORD_LIMIT,
    );
    expectCode(
        () =>
            frame([
                { kind: "destroy", id: "C1" },
                { kind: "destroy", id: "C1" },
            ]),
        ProtocolErrorCode.DUPLICATE_ENTITY,
    );
    expectCode(() => decodeSnapshotV3([frameWithPayload([0x82, 1, 0x82, 1], 2)]), ProtocolErrorCode.DUPLICATE_ENTITY);
});

test("protocol/v3: 2000 moving enemies use at least 70 percent fewer payload bytes than v2", () => {
    const source = snapshot(
        Array.from(
            { length: 2000 },
            (_, index): EntityRecord => ({
                kind: "update",
                id: `B${index + 1}`,
                prefab: "Michau",
                transform: { x: 1000 + index / 10, y: 1500 + index / 10 },
            }),
        ),
    );
    const bytes = (frames: readonly ArrayBuffer[]) => frames.reduce((total, encoded) => total + encoded.byteLength, 0);
    const oldBytes = bytes(encodeSnapshot(source));
    const newBytes = bytes(encodeSnapshotV3(source));
    assert.equal(oldBytes, 84_256);
    assert.equal(newBytes, 24_129);
    assert.ok(newBytes < oldBytes * 0.3);
});

test("protocol/v3: deterministic malformed-frame fuzzing never leaks native parser errors", () => {
    let seed = 0x12345678;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
    };
    const valid = frame([{ kind: "create", state: entity("DefaultPlayer") }]);
    for (let iteration = 0; iteration < 2000; iteration++) {
        const bytes = iteration % 2 === 0 ? new Uint8Array(valid.slice(0)) : new Uint8Array(random() % 512);
        const mutations = iteration % 2 === 0 ? 1 + (random() % 4) : bytes.length;
        for (let index = 0; index < mutations; index++)
            if (bytes.length > 0) bytes[random() % bytes.length] = random() & 0xff;
        try {
            const decoded = decodeSnapshotV3([bytes.buffer]);
            assert.deepEqual(decodeSnapshotV3(encodeSnapshotV3(decoded)), decoded);
        } catch (error) {
            assert.ok(error instanceof ProtocolError, `iteration ${iteration}: ${String(error)}`);
        }
    }
});
