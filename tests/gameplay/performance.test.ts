import assert from "node:assert/strict";
import test from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { PerformanceController } from "../../server/runtime/PerformanceController";
import {
    PERFORMANCE_COUNTS,
    validatePerformanceConfiguration,
    isPerformanceState,
} from "../../shared/gameplay/Performance";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Player } from "../../shared/game_utils/game/objects/Player";

const setup = (count = 100) => ({ count, distribution: "nearby", scenario: "moving" });

test("performance: setup accepts only bounded counts, distributions and scenarios", () => {
    for (const count of PERFORMANCE_COUNTS) assert.equal(validatePerformanceConfiguration(setup(count)).count, count);
    for (const value of [
        null,
        [],
        {},
        setup(-1),
        setup(2001),
        setup(2 ** 32),
        setup(NaN),
        { ...setup(), distribution: "everywhere" },
        { ...setup(), scenario: "random" },
        { ...setup(), extra: 1 },
        { ...setup(), count: "100" },
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

test("performance: maximum world population spans all chunks and can be cancelled during loading", () => {
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
        for (const chunk of core.ChunksManager.ChunksIterator()) assert.equal(chunk.Objects.length, 80);
        assert.throws(() => controller.configure(setup(1000000)));
        assert.equal(controller.state().enemies, 2000, "invalid setup leaves the current test intact");
    } finally {
        controller.dispose();
        core.dispose();
    }
    assert.equal(core.ObjectsManager.ObjectsById.size, 0);
});
