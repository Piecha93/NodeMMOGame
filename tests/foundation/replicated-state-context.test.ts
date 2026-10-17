import assert from "node:assert/strict";
import test from "node:test";
import { ReplicatedState } from "../../shared/core/ReplicatedState";
import { WorldContext } from "../../shared/core/WorldContext";
import { Origin } from "../../shared/core/Origin";
import { GameCore } from "../../shared/GameCore";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Transform } from "../../shared/game_utils/physics/Transform";

class StateProbe extends ReplicatedState {
    constructor(readContext = false) {
        super();
        this.addChange("constructor");
        if (readContext) this.Runtime.tick = 17;
    }

    protectedContext(): WorldContext {
        return this.runtime;
    }
}

test("replicated context: standalone objects retain independent server contexts and constructor changes", () => {
    const first = new StateProbe();
    const second = new StateProbe();
    assert.equal(first.hasChange("constructor"), true);
    assert.equal(first.Runtime.isServer, true);
    assert.equal(first.protectedContext(), first.Runtime);
    assert.notEqual(first.Runtime, second.Runtime);
    first.Runtime.tick = 25;
    assert.equal(second.Runtime.tick, 0);
    first.commitReplicationChanges();
    assert.equal(first.hasChange("constructor"), false);
    first.addChange("next");
    assert.equal(first.hasChange("next"), true);
});

test("replicated context: attaching a client world preserves its deserialized-field semantics", () => {
    const state = new StateProbe();
    const client = new WorldContext({ role: Origin.CLIENT });
    state.setRuntime(client);
    assert.equal(state.Runtime, client);
    assert.equal(state.hasChange("constructor"), false);
    state.addChange("client-local");
    assert.equal(state.hasChange("client-local"), false);
    state.DeserializedFields.add("received");
    assert.equal(state.hasChange("received"), true);
});

test("replicated context: a constructor-requested fallback can be replaced by an owning world", () => {
    const state = new StateProbe(true);
    const fallback = state.Runtime;
    const owner = new WorldContext({ role: Origin.SERVER });
    owner.tick = 9;
    state.setRuntime(owner);
    assert.notEqual(state.Runtime, fallback);
    assert.equal(state.protectedContext().tick, 9);
    assert.equal(fallback.tick, 17);
    assert.equal(state.hasChange("constructor"), true);
});

test("replicated context: factory objects and nested transforms use the owner's exact context", () => {
    const core = new GameCore({ role: Origin.SERVER, performanceMode: true });
    try {
        const standalone = new Enemy(new Transform([100, 100], 32));
        assert.notEqual(standalone.Runtime, standalone.Transform.Runtime);
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [100, 100]);
        assert.equal(enemy.Runtime, core.Runtime);
        assert.equal(enemy.Transform.Runtime, core.Runtime);
        core.Runtime.tick = 45;
        assert.equal(enemy.Transform.Runtime.tick, 45);
        assert.equal(enemy.Runtime.tick, 45);
        standalone.destroy();
    } finally {
        core.dispose();
    }
});
