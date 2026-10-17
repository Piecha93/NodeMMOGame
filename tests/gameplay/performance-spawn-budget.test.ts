import assert from "node:assert/strict";
import test, { TestContext } from "node:test";
import { PerformanceController } from "../../server/runtime/PerformanceController";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { InputSnapshot } from "../../shared/input/InputSnapshot";

function fixture(t: TestContext, creationCostMs = 0.5, spawnBudgetMs = 1) {
    let cpuMs = 0;
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    const controller = new PerformanceController(core, { clock: () => cpuMs, spawnBudgetMs });
    const factory = core.ObjectsFactory;
    const instantiate = factory.instantiateWithPosition.bind(factory);
    const created: Enemy[] = [];
    t.mock.method(factory, "instantiateWithPosition", (...args: Parameters<typeof instantiate>) => {
        const object = instantiate(...args);
        if (args[0] === "Michau") {
            assert.ok(object instanceof Enemy);
            created.push(object);
            // Include the entire construction/registration/spatial-insertion call.
            cpuMs += creationCostMs;
        }
        return object;
    });
    t.after(() => {
        controller.dispose();
        core.dispose();
    });
    return {
        core,
        controller,
        created,
        spendCpu(ms: number) {
            cpuMs += ms;
        },
    };
}

test("performance loading: completed construction cost limits each batch without losing pending enemies", (t) => {
    const { core, controller } = fixture(t, 0.5);
    controller.configure({ count: 5, distribution: "nearby", scenario: "static" });
    for (const enemies of [2, 4, 5]) {
        core.step();
        const state = controller.state();
        assert.equal(state.enemies, enemies);
        assert.equal(state.pending, 5 - enemies);
        assert.equal(state.objects, enemies);
    }
    core.step();
    assert.equal(controller.state().enemies, 5, "finished loading must not create replacements");
    assert.equal(core.droppedTimeMs, 0);
});

test("performance loading: one slow creation still makes progress and every queued position eventually spawns", (t) => {
    const { core, controller, created } = fixture(t, 4);
    controller.configure({ count: 7, distribution: "nearby", scenario: "static" });
    for (let completed = 1; completed <= 7; completed++) {
        core.step();
        assert.equal(controller.state().enemies, completed);
        assert.equal(controller.state().pending, 7 - completed);
    }
    assert.equal(new Set(created.map((enemy) => enemy.ID)).size, 7);
    assert.equal(new Set(created.map((enemy) => enemy.Transform.Position.join(":"))).size, 7);
});

test("performance loading: a busy previous simulation leaves only one creation, then capacity recovers", (t) => {
    const { core, controller, spendCpu } = fixture(t, 0.5);
    let simulationCostMs = 20;
    core.subscribeBeforeStep(() => spendCpu(simulationCostMs));
    controller.configure({ count: 10, distribution: "nearby", scenario: "static" });
    core.step();
    assert.equal(controller.state().enemies, 2);
    core.step();
    assert.equal(controller.state().enemies, 3, "loading retains minimum progress with no simulation headroom");
    simulationCostMs = 0;
    core.step();
    assert.equal(controller.state().enemies, 4, "the last measured busy tick still bounds this batch");
    core.step();
    assert.equal(controller.state().enemies, 6, "cheap simulation restores the configured creation budget");
});

test("performance loading: exhausting the creation budget preserves every existing AI, player and collision tick", (t) => {
    const { core, controller } = fixture(t, 0.75);
    const center = controller.spawnPosition();
    const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", center) as Player;
    const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [center[0] + 200, center[1] + 200]) as Enemy;
    enemy.configurePerformance("moving", 0, () => [player]);
    const enemyUpdate = enemy.update.bind(enemy);
    const updates: number[] = [];
    t.mock.method(enemy, "update", (delta: number) => {
        updates.push(delta);
        enemyUpdate(delta);
    });
    const collisions = t.mock.method(core.CollisionsSystem, "update");
    const startX = player.Transform.X;
    player.setInput(new InputSnapshot("0=2:0#5:1"));
    controller.configure({ count: 10, distribution: "world", scenario: "static" });
    for (let tick = 0; tick < 5; tick++) core.step();
    const fixed = core.Runtime.config.fixedDeltaMs;
    assert.deepEqual(updates, Array(5).fill(fixed));
    assert.equal(collisions.mock.callCount(), 5);
    assert.equal(player.Transform.X, startX + 5 * player.Velocity * fixed);
    assert.equal(core.Runtime.tick, 5);
    assert.equal(core.Runtime.timeMs, 5 * fixed);
    assert.equal(controller.state().enemies, 10);
    assert.equal(controller.state().pending, 0);
    assert.equal(core.droppedTimeMs, 0);
});

test("performance loading: tiny batches still distribute early creations fairly over the world", (t) => {
    const { core, controller, created } = fixture(t, 2);
    controller.configure({ count: 137, distribution: "world", scenario: "static" });
    for (let tick = 0; tick < 25; tick++) core.step();
    assert.equal(created.length, 25);
    assert.equal(new Set(created.map((enemy) => core.ChunksManager.getObjectChunk(enemy))).size, 25);
    assert.equal(controller.state().pending, 112);
});

test("performance loading: replacing, cancelling and disposing a partial batch never resumes old work", (t) => {
    const { core, controller, created } = fixture(t, 0.5);
    controller.configure({ count: 100, distribution: "nearby", scenario: "static" });
    core.step();
    const previous = [...created];
    assert.equal(controller.state().pending, 98);
    assert.throws(() => controller.configure({ count: -1, distribution: "world", scenario: "static" }));
    assert.equal(controller.state().pending, 98);
    assert.equal(controller.state().enemies, 2);
    controller.configure({ count: 3, distribution: "world", scenario: "static" });
    assert.ok(previous.every((enemy) => enemy.IsDestroyed));
    core.step();
    assert.equal(controller.state().enemies, 2);
    assert.equal(controller.state().pending, 1);
    controller.configure({ count: 0, distribution: "nearby", scenario: "static" });
    const cancelledCreations = created.length;
    core.step();
    assert.equal(created.length, cancelledCreations);
    assert.equal(controller.state().enemies, 0);
    assert.equal(controller.state().pending, 0);
    controller.configure({ count: 100, distribution: "nearby", scenario: "static" });
    core.step();
    controller.dispose();
    const disposedCreations = created.length;
    core.step();
    assert.equal(created.length, disposedCreations);
    assert.equal(core.ObjectsManager.ObjectsById.size, 0);
});

test("performance loading: configuration preserves cumulative discarded time and exposes each additional stall", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true, fixedDeltaMs: 10, maxCatchUpSteps: 2 });
    const controller = new PerformanceController(core, { clock: () => 0 });
    try {
        assert.equal(core.advance(100), 2);
        const before = controller.state().droppedTimeMs;
        assert.equal(before, 80);
        controller.configure({ count: 5000, distribution: "nearby", scenario: "static" });
        assert.equal(controller.state().droppedTimeMs, before);
        core.advance(10);
        assert.equal(controller.state().droppedTimeMs, before);
        controller.configure({ count: 0, distribution: "nearby", scenario: "static" });
        assert.equal(controller.state().droppedTimeMs, before);
        assert.equal(core.advance(40), 2);
        assert.equal(controller.state().droppedTimeMs - before, 20);
        assert.equal(controller.state().droppedTimeMs, 100);
    } finally {
        controller.dispose();
        core.dispose();
    }
});

test("performance loading: invalid CPU budgets are rejected before a controller starts", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    try {
        for (const spawnBudgetMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, core.Runtime.config.fixedDeltaMs + 1])
            assert.throws(() => new PerformanceController(core, { spawnBudgetMs }), RangeError);
        assert.throws(() => new PerformanceController(core, { clock: 0 as unknown as () => number }), TypeError);
        core.step();
        assert.equal(core.ObjectsManager.ObjectsById.size, 0);
    } finally {
        core.dispose();
    }
});
