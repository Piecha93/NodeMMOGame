import assert from "node:assert/strict";
import test from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { PerformanceController } from "../../server/runtime/PerformanceController";
import {
    PERFORMANCE_MAX_ENEMIES,
    validatePerformanceConfiguration,
    isPerformanceState,
} from "../../shared/gameplay/Performance";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Player } from "../../shared/game_utils/game/objects/Player";

const setup = (count = 100) => ({ count, distribution: "nearby", scenario: "moving" });

test("performance: setup accepts only bounded counts, distributions and scenarios", () => {
    for (const count of [0, 1, 137, 2001, 12_345, PERFORMANCE_MAX_ENEMIES])
        assert.equal(validatePerformanceConfiguration(setup(count)).count, count);
    for (const value of [
        null,
        [],
        {},
        setup(-1),
        setup(PERFORMANCE_MAX_ENEMIES + 1),
        setup(1.5),
        setup(2 ** 32),
        setup(NaN),
        setup(Infinity),
        { ...setup(), distribution: "everywhere" },
        { ...setup(), scenario: "random" },
        { ...setup(), extra: 1 },
        { ...setup(), count: "100" },
        { ...setup(), count: true },
    ])
        assert.throws(() => validatePerformanceConfiguration(value));
});

test("performance: population batches, resets and never changes a second world", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    const normal = new GameCore({ role: Origin.SERVER });
    const controller = new PerformanceController(core);
    try {
        const player = core.ObjectsFactory.instantiateWithPosition(
            "DefaultPlayer",
            controller.spawnPosition(),
        ) as Player;
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [100, 100]);
        const other = normal.ObjectsFactory.instantiateWithPosition("Michau", [100, 100]);
        controller.configure(setup(100));
        assert.equal(controller.state().pending, 100);
        assert.equal(controller.state().enemies, 0);
        core.step();
        assert.equal(controller.state().enemies, 80);
        core.step();
        assert.equal(controller.state().enemies, 100);
        assert.equal(controller.state().pending, 0);
        assert.equal(controller.state().tickSamples, 2);
        assert.ok(controller.state().tickP95Ms > 0);
        assert.ok(isPerformanceState(controller.state()));
        const firstIDs = new Set(core.ObjectsManager.ObjectsById.keys());
        controller.configure({ count: 100, distribution: "world", scenario: "static" });
        assert.equal(controller.state().enemies, 0, "new setup replaces the old population before batching");
        core.step();
        core.step();
        const enemies = [...core.ObjectsManager.ObjectsById.values()].filter((object) => object instanceof Enemy);
        assert.equal(enemies.length, 100);
        assert.ok(enemies.every((enemy) => !firstIDs.has(enemy.ID)));
        assert.equal(new Set(enemies.map((enemy) => core.ChunksManager.getObjectChunk(enemy))).size, 25);
        // No player visits the remote chunks; time alone must not erase a benchmark.
        core.step(2000);
        core.step();
        assert.equal(controller.state().enemies, 100);
        assert.equal(controller.state().activeChunks, 25);
        const projectile = core.ObjectsFactory.instantiateWithPosition("FireBall", [100, 200]);
        controller.configure(setup(0));
        assert.equal(controller.state().pending, 0);
        assert.equal(controller.state().enemies, 0);
        assert.equal(projectile.IsDestroyed, true);
        assert.equal(wall.IsDestroyed, false);
        assert.equal(player.IsDestroyed, false);
        assert.equal(other.IsDestroyed, false);
        assert.equal(normal.ObjectsManager.ObjectsById.size, 1);
        player.hit(1_000_000);
        assert.equal(player.HP, player.MaxHP, "only a performance-world player is invulnerable");
        const ordinary = normal.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [200, 200]) as Player;
        ordinary.hit(1_000_000);
        assert.equal(ordinary.HP, 0);
    } finally {
        controller.dispose();
        core.dispose();
        normal.dispose();
    }
});

test("performance: world population spans all chunks and can be cancelled during loading", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    const controller = new PerformanceController(core);
    try {
        controller.configure({ count: 2000, distribution: "world", scenario: "static" });
        core.step();
        controller.configure(setup(0));
        core.step();
        assert.equal(controller.state().enemies, 0);
        controller.configure({ count: 2000, distribution: "world", scenario: "static" });
        for (let index = 0; index < 25; index++) core.step();
        assert.equal(controller.state().enemies, 2000);
        assert.equal(controller.state().pending, 0);
        assert.equal(core.ObjectsManager.ObjectsById.size, 2000);
        for (const chunk of core.ChunksManager.ChunksIterator()) assert.ok(chunk.Objects.length > 0);
        assert.throws(() => controller.configure(setup(1000000)));
        assert.equal(controller.state().enemies, 2000, "invalid setup leaves the current test intact");
    } finally {
        controller.dispose();
        core.dispose();
    }
    assert.equal(core.ObjectsManager.ObjectsById.size, 0);
});

test("performance: arbitrary populations preserve the exact requested count and the 80-per-tick loading limit", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    const controller = new PerformanceController(core);
    try {
        for (const count of [1, 137, 321]) {
            controller.configure({ count, distribution: "world", scenario: "static" });
            for (let index = 0; index < Math.ceil(count / 80); index++) {
                core.step();
                assert.equal(controller.state().enemies, Math.min((index + 1) * 80, count));
            }
            assert.equal(controller.state().pending, 0);
            assert.ok(isPerformanceState(controller.state()));
        }
    } finally {
        controller.dispose();
        core.dispose();
    }
});

test("performance: maximum layouts have distinct unmodified positions safely inside every world edge", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    const controller = new PerformanceController(core);
    try {
        const width = core.Runtime.config.chunkSize * core.Runtime.config.numOfChunksX;
        const height = core.Runtime.config.chunkSize * core.Runtime.config.numOfChunksY;
        const internal = controller as unknown as { positions: Array<[number, number]> };
        for (const distribution of ["nearby", "world"] as const)
            for (const center of [
                [0, 0],
                [width - 1, height - 1],
            ] as const) {
                controller.configure({ count: PERFORMANCE_MAX_ENEMIES, distribution, scenario: "static" }, center);
                const positions = internal.positions;
                assert.equal(positions.length, PERFORMANCE_MAX_ENEMIES);
                assert.equal(new Set(positions.map(([x, y]) => `${x}:${y}`)).size, PERFORMANCE_MAX_ENEMIES);
                for (const [x, y] of positions) {
                    assert.ok(x >= 64 && x <= width - 64 && y >= 64 && y <= height - 64);
                    assert.ok(core.ChunksManager.getChunkAtPosition(x, y));
                }
                if (distribution === "world")
                    assert.equal(
                        new Set(positions.map(([x, y]) => core.ChunksManager.getChunkAtPosition(x, y))).size,
                        25,
                    );
                // Every occupied row/column has room for 32 px actors, with no
                // out-of-range positions later collapsing onto a clamped edge.
                for (const axis of [0, 1]) {
                    const coordinates = [...new Set(positions.map((position) => position[axis]!))].sort(
                        (a, b) => a - b,
                    );
                    for (let index = 1; index < coordinates.length; index++)
                        assert.ok(coordinates[index]! - coordinates[index - 1]! >= 32 - 1e-9);
                }
                core.step();
                assert.equal(controller.state().enemies, 80);
                assert.equal(controller.state().pending, PERFORMANCE_MAX_ENEMIES - 80);
                assert.ok(isPerformanceState(controller.state()));
            }
    } finally {
        controller.dispose();
        core.dispose();
    }
});

test("performance: a world too small for a population rejects it without replacing the current workload", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true, numOfChunksX: 1, numOfChunksY: 1 });
    const controller = new PerformanceController(core);
    try {
        controller.configure({ count: 1, distribution: "nearby", scenario: "static" });
        core.step();
        for (const distribution of ["nearby", "world"] as const)
            assert.throws(
                () => controller.configure({ count: PERFORMANCE_MAX_ENEMIES, distribution, scenario: "static" }),
                /does not fit/,
            );
        assert.equal(controller.state().enemies, 1);
        assert.equal(controller.state().count, 1);
        assert.equal(controller.state().pending, 0);
    } finally {
        controller.dispose();
        core.dispose();
    }
});

test("performance: the full maximum spawns without clamping or dropping enemies at the world borders", {
    timeout: 60_000,
}, () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    const controller = new PerformanceController(core);
    try {
        controller.configure({ count: PERFORMANCE_MAX_ENEMIES, distribution: "world", scenario: "static" });
        const planned = new Set(
            (controller as unknown as { positions: Array<[number, number]> }).positions.map(([x, y]) => `${x}:${y}`),
        );
        for (let index = 0; index < Math.ceil(PERFORMANCE_MAX_ENEMIES / 80); index++) core.step();
        const state = controller.state();
        assert.equal(state.enemies, PERFORMANCE_MAX_ENEMIES);
        assert.equal(state.objects, PERFORMANCE_MAX_ENEMIES);
        assert.equal(state.pending, 0);
        assert.equal(state.activeChunks, 25);
        assert.ok(isPerformanceState(state));
        const actual = new Set<string>();
        for (const enemy of core.ObjectsManager.ObjectsById.values()) {
            assert.ok(enemy instanceof Enemy);
            const [x, y] = enemy.Transform.Position;
            const key = `${x}:${y}`;
            assert.ok(planned.has(key), "world-boundary correction must not move a generated spawn");
            actual.add(key);
            assert.equal(enemy.Colliders[0]?.Body.x, x);
            assert.equal(enemy.Colliders[0]?.Body.y, y);
        }
        assert.equal(actual.size, PERFORMANCE_MAX_ENEMIES);
    } finally {
        controller.dispose();
        core.dispose();
    }
});
