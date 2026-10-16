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

function projectile(x: number): EntityState {
    return {
        ...state(x),
        id: "F1",
        prefab: "FireBall",
        fields: { velocity: 1 },
    };
}

test("projectile presentation: a single new sample moves immediately and extrapolation stops after 80 ms", () => {
    let now = 1000;
    const interpolation = new SnapshotInterpolator(10, 100, () => now);
    interpolation.push(100, [projectile(200)]);
    assert.deepEqual(interpolation.positions().get("F1"), [200, 50]);
    now += 16;
    assert.deepEqual(interpolation.positions().get("F1"), [216, 50], "a new shot must not freeze for the actor buffer");
    now += 10_000;
    assert.deepEqual(interpolation.positions().get("F1"), [280, 50]);
    interpolation.push(102, []);
    assert.equal(
        interpolation.positions().has("F1"),
        false,
        "authoritative collision/removal ends the shot immediately",
    );
});

test("projectile presentation: irregular packet arrivals preserve continuous motion at 30, 60 and 144 FPS", () => {
    const packets = [
        { tick: 100, arrival: 0, x: 0 },
        { tick: 104, arrival: 55, x: 40 },
        { tick: 108, arrival: 83, x: 80 },
        { tick: 112, arrival: 139, x: 120 },
        { tick: 116, arrival: 164, x: 160 },
        { tick: 120, arrival: 218, x: 200 },
    ];
    for (const fps of [30, 60, 144]) {
        let now = 0;
        let packetIndex = 0;
        const interpolation = new SnapshotInterpolator(10, 100, () => now);
        for (let frame = 0; frame <= fps / 4; frame++) {
            const frameTime = frame * (1000 / fps);
            while (packets[packetIndex] && packets[packetIndex].arrival <= frameTime) {
                const packet = packets[packetIndex++];
                now = packet.arrival;
                interpolation.push(packet.tick, [projectile(packet.x)]);
            }
            now = frameTime;
            const position = interpolation.positions().get("F1");
            assert.ok(position);
            assert.ok(Math.abs(position[0] - frameTime) < 1e-9, `${fps} FPS flight must not reset on each packet`);
        }
    }
});

test("projectile presentation: tick wrap keeps the trajectory and authoritative direction changes reset it", () => {
    let now = 1000;
    const interpolation = new SnapshotInterpolator(10, 100, () => now);
    interpolation.push(0xfffffffe, [projectile(0)]);
    now = 1040;
    interpolation.push(1, [projectile(30)]);
    assert.deepEqual(interpolation.positions().get("F1"), [40, 50]);
    const straight = projectile(100);
    const turned = { ...straight, transform: { ...straight.transform, rotation: Math.PI / 2 } };
    interpolation.push(2, [turned]);
    assert.deepEqual(interpolation.positions().get("F1"), [100, 50]);
    now += 20;
    assert.deepEqual(interpolation.positions().get("F1"), [100, 70]);
});
