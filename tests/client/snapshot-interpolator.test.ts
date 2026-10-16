import assert from "node:assert/strict";
import { test } from "node:test";
import { SnapshotInterpolator } from "../../client/net/SnapshotInterpolator";
import { EntityState } from "../../shared/protocol";

function state(x: number): EntityState {
    return {
        id: "A1",
        prefab: "DefaultPlayer",
        fields: {},
        transform: { x, y: 50, scaleX: 32, scaleY: 32, rotation: 0 },
    };
}

test("snapshot interpolation: uses delayed server time and freezes at the newest sample during a long outage", () => {
    let now = 1000;
    const interpolation = new SnapshotInterpolator(10, 20, () => now);
    interpolation.push(100, [state(0)]);
    now = 1100;
    interpolation.push(110, [state(100)]);
    assert.deepEqual(interpolation.positions().get("A1"), [80, 50]);
    now += 10;
    assert.deepEqual(interpolation.positions().get("A1"), [90, 50]);
    now = 100_000;
    assert.deepEqual(
        interpolation.positions().get("A1"),
        [100, 50],
        "remote entities must not extrapolate indefinitely",
    );
});

test("snapshot interpolation: tick wrap preserves the interpolation timeline", () => {
    const interpolation = new SnapshotInterpolator(10, 15, () => 1000);
    interpolation.push(0xfffffffe, [state(0)]);
    interpolation.push(1, [state(30)]);
    assert.deepEqual(interpolation.positions().get("A1"), [15, 50]);
});

test("snapshot interpolation: history is bounded and leaving interest releases samples", () => {
    const interpolation = new SnapshotInterpolator(10, 20, () => 1000);
    for (let tick = 0; tick < 1000; tick++) interpolation.push(tick, [state(tick)]);
    const internals = interpolation as unknown as { samples: Map<string, unknown[]> };
    assert.ok((internals.samples.get("A1")?.length ?? 0) <= 32);
    interpolation.push(1000, []);
    assert.equal(interpolation.positions().has("A1"), false);
    assert.equal(internals.samples.size, 0);
});
