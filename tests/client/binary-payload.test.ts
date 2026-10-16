import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeBinaryPayload } from "../../client/net/BinaryPayload";

function bytes(buffer: ArrayBuffer): number[] {
    return Array.from(new Uint8Array(buffer));
}

test("normalizes direct ArrayBuffer payloads", () => {
    const payload = Uint8Array.from([1, 2, 3]).buffer;

    assert.equal(normalizeBinaryPayload(payload), payload);
});

test("normalizes typed-array slices without including unrelated bytes", () => {
    const source = Uint8Array.from([9, 1, 2, 3, 9]);
    const payload = source.subarray(1, 4);

    const normalized = normalizeBinaryPayload(payload);
    assert.ok(normalized);
    assert.deepEqual(bytes(normalized), [1, 2, 3]);
});

test("normalizes notepack browser extension payloads", () => {
    const payload = [0, Uint8Array.from([4, 5, 6])] as const;

    const normalized = normalizeBinaryPayload(payload);
    assert.ok(normalized);
    assert.deepEqual(bytes(normalized), [4, 5, 6]);
});

test("rejects malformed binary payloads", () => {
    assert.equal(normalizeBinaryPayload([1, Uint8Array.from([1])]), null);
    assert.equal(normalizeBinaryPayload("not binary"), null);
});
