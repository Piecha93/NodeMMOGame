import assert from "node:assert/strict";
import {test} from "node:test";

import {GameCore} from "../../shared/GameCore";
import {registerGameObjectPrefabs} from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import {ProtocolDecodeError} from "../../shared/serialize/ProtocolDecodeError";

registerGameObjectPrefabs();

const DecodeErrorCode = Object.freeze({
    TRUNCATED_OBJECT_HEADER: "TRUNCATED_OBJECT_HEADER",
    TRUNCATED_TOMBSTONE_ID: "TRUNCATED_TOMBSTONE_ID",
    UNKNOWN_PROPERTY_MASK: "UNKNOWN_PROPERTY_MASK",
    UNKNOWN_PREFAB: "UNKNOWN_PREFAB",
    TRUNCATED_OBJECT_PAYLOAD: "TRUNCATED_OBJECT_PAYLOAD",
} as const);

const GOLDEN_COMPLETE_WALL = bufferFromBytes([
    0x43, 0x00, 0x00, 0x00, 0x2A, // C42
    0x0F,                         // complete GameObject mask
    0x00, 0x00, 0x00, 0x00,       // velocity = 0
    0x00,                         // invisible = false
    0x00, 0x01,                   // sprite = wall
    0x1F,                         // complete Transform mask
    0x00, 0x20,                   // scaleX = 32
    0x00, 0x20,                   // scaleY = 32
    0x42, 0xC8, 0x00, 0x00,       // x = 100
    0x43, 0x48, 0x00, 0x00,       // y = 200
    0x00, 0x00, 0x00, 0x00,       // rotation = 0
]);

const UNKNOWN_PREFAB_HEADER = bufferFromBytes([
    0x5A, 0x00, 0x00, 0x00, 0x01, // Z1
]);

interface ExpectedDecodeError {
    code: string;
    offset: number;
}

function bufferFromBytes(bytes: readonly number[]): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}

function concatBuffers(...buffers: readonly ArrayBuffer[]): ArrayBuffer {
    const result = new Uint8Array(buffers.reduce(
        (total: number, buffer: ArrayBuffer) => total + buffer.byteLength,
        0,
    ));
    let offset: number = 0;

    buffers.forEach((buffer: ArrayBuffer) => {
        result.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    });

    return result.buffer;
}

function wallRecordWithSequence(sequence: number): ArrayBuffer {
    const record = GOLDEN_COMPLETE_WALL.slice(0);
    new DataView(record).setUint32(1, sequence);
    return record;
}

function expectDecodeError(
    core: GameCore,
    payload: ArrayBuffer,
    expected: ExpectedDecodeError,
    context?: string,
): void {
    assert.throws(
        () => core.decodeUpdate(payload),
        (error: unknown) => {
            assert.ok(error instanceof ProtocolDecodeError, context);
            const protocolError = error as ProtocolDecodeError;
            assert.equal(protocolError.code, expected.code, `${context ?? "decode"}: code`);
            assert.equal(protocolError.offset, expected.offset, `${context ?? "decode"}: offset`);
            return true;
        },
    );
}

function expectedWallTruncation(byteLength: number): ExpectedDecodeError {
    if(byteLength < 5) {
        return {code: DecodeErrorCode.TRUNCATED_OBJECT_HEADER, offset: 0};
    }

    const payloadFields: ReadonlyArray<{offset: number; size: number}> = [
        {offset: 5, size: 1},  // GameObject mask
        {offset: 6, size: 4},  // velocity
        {offset: 10, size: 1}, // invisible
        {offset: 11, size: 2}, // sprite
        {offset: 13, size: 1}, // Transform mask
        {offset: 14, size: 2}, // scaleX
        {offset: 16, size: 2}, // scaleY
        {offset: 18, size: 4}, // x
        {offset: 22, size: 4}, // y
        {offset: 26, size: 4}, // rotation
    ];
    const truncatedField = payloadFields.find(({offset, size}) => byteLength < offset + size);

    assert.ok(truncatedField);
    return {code: DecodeErrorCode.TRUNCATED_OBJECT_PAYLOAD, offset: truncatedField.offset};
}

test("foundation/protocol v1 decoder: the hand-authored complete Wall record remains valid", () => {
    const core = new GameCore();

    try {
        core.decodeUpdate(GOLDEN_COMPLETE_WALL);

        const wall = core.ObjectsManager.get("C42");
        assert.ok(wall);
        assert.deepEqual(wall.Transform.Position, [100, 200]);
        assert.equal(wall.Transform.ScaleX, 32);
        assert.equal(wall.Transform.ScaleY, 32);
        assert.equal(wall.SpriteName, "wall");
    } finally {
        core.dispose();
    }
});

test("foundation/protocol v1 decoder: malformed structures expose controlled codes and offsets", async (t) => {
    const cases: ReadonlyArray<{
        name: string;
        payload: ArrayBuffer;
        expected: ExpectedDecodeError;
    }> = [
        {
            name: "truncated object header",
            payload: bufferFromBytes([0x43, 0x00, 0x00]),
            expected: {code: DecodeErrorCode.TRUNCATED_OBJECT_HEADER, offset: 0},
        },
        {
            name: "truncated tombstone id",
            payload: bufferFromBytes([0xFF, 0x43, 0x00, 0x00]),
            expected: {code: DecodeErrorCode.TRUNCATED_TOMBSTONE_ID, offset: 1},
        },
        {
            name: "unknown property-mask bit",
            payload: bufferFromBytes([0x43, 0x00, 0x00, 0x00, 0x2A, 0x80]),
            expected: {code: DecodeErrorCode.UNKNOWN_PROPERTY_MASK, offset: 5},
        },
        {
            name: "unknown prefab",
            payload: UNKNOWN_PREFAB_HEADER,
            expected: {code: DecodeErrorCode.UNKNOWN_PREFAB, offset: 0},
        },
        {
            name: "known prefab without payload",
            payload: bufferFromBytes([0x43, 0x00, 0x00, 0x00, 0x2A]),
            expected: {code: DecodeErrorCode.TRUNCATED_OBJECT_PAYLOAD, offset: 5},
        },
    ];

    for(const malformedCase of cases) {
        await t.test(malformedCase.name, () => {
            const core = new GameCore();
            try {
                expectDecodeError(core, malformedCase.payload, malformedCase.expected, malformedCase.name);
                assert.equal(core.ObjectsManager.ObjectsById.size, 0);
            } finally {
                core.dispose();
            }
        });
    }
});

test("foundation/protocol v1 decoder: every non-empty truncation of a complete Wall is controlled", () => {
    for(let byteLength = 1; byteLength < GOLDEN_COMPLETE_WALL.byteLength; byteLength++) {
        const core = new GameCore();
        try {
            expectDecodeError(
                core,
                GOLDEN_COMPLETE_WALL.slice(0, byteLength),
                expectedWallTruncation(byteLength),
                `Wall truncated to ${byteLength} bytes`,
            );
            assert.equal(core.ObjectsManager.ObjectsById.size, 0);
        } finally {
            core.dispose();
        }
    }
});

test("foundation/protocol v1 decoder: a malformed tail applies neither valid updates nor creates", () => {
    const core = new GameCore();

    try {
        const existingWall = core.ObjectsFactory.instantiateWithPosition("Wall", [300, 300], undefined, "C7");
        const objectIdsBefore = Array.from(core.ObjectsManager.ObjectsById.keys());
        const payload = concatBuffers(
            wallRecordWithSequence(7),
            GOLDEN_COMPLETE_WALL,
            UNKNOWN_PREFAB_HEADER,
        );

        expectDecodeError(
            core,
            payload,
            {code: DecodeErrorCode.UNKNOWN_PREFAB, offset: 60},
            "valid records followed by an unknown prefab",
        );

        assert.deepEqual(Array.from(core.ObjectsManager.ObjectsById.keys()), objectIdsBefore);
        assert.equal(core.ObjectsManager.get("C7"), existingWall);
        assert.deepEqual(existingWall.Transform.Position, [300, 300]);
        assert.equal(core.ObjectsManager.get("C42"), undefined);
    } finally {
        core.dispose();
    }
});

test("foundation/protocol v1 decoder: a tombstone remainder not divisible by five is atomic", () => {
    const core = new GameCore();

    try {
        const existingWall = core.ObjectsFactory.instantiateWithPosition("Wall", [300, 300], undefined, "C42");
        const malformedTombstones = bufferFromBytes([
            0xFF,
            0x43, 0x00, 0x00, 0x00, 0x2A, // complete C42 tombstone
            0x43, 0x00,                   // incomplete next tombstone
        ]);

        expectDecodeError(
            core,
            malformedTombstones,
            {code: DecodeErrorCode.TRUNCATED_TOMBSTONE_ID, offset: 6},
            "non-divisible tombstone remainder",
        );

        assert.equal(core.ObjectsManager.get("C42"), existingWall);
        assert.equal(existingWall.IsDestroyed, false);
    } finally {
        core.dispose();
    }
});
