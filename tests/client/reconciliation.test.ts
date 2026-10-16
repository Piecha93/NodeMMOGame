import assert from "node:assert/strict";
import { test } from "node:test";
import { Reconciliation } from "../../client/Reconciliation";
import { InputSnapshot } from "../../shared/input/InputSnapshot";
import { Origin, SharedConfig } from "../../shared/SharedConfig";
import { ChangesDict } from "../../shared/serialize/ChangesDict";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Obstacle } from "../../shared/game_utils/game/objects/Obstacle";
import { CollisionsSystem } from "../../shared/game_utils/physics/CollisionsSystem";
import { Transform } from "../../shared/game_utils/physics/Transform";

test("reconciliation: replay stops at a wall and leaves colliders at the corrected position", (t) => {
    const origin = SharedConfig.ORIGIN;
    SharedConfig.ORIGIN = Origin.CLIENT;
    let now = 1000;
    t.mock.method(Date, "now", () => now);

    try {
        const player = new Player(new Transform([100, 100], [32, 32]));
        const wall = new Obstacle(new Transform([160, 100], [32, 32]));
        const collisions = new CollisionsSystem();
        collisions.insertObject(player);
        collisions.insertObject(wall);
        collisions.update();
        player.Transform.DeserializedFields.add(ChangesDict.X);

        const input = new InputSnapshot("1=2:0#5:1");
        now += 200;
        input.setSnapshotDelta();
        const reconciliation = new Reconciliation();
        reconciliation.pushSnapshotToHistory(input);
        reconciliation.LastServerSnapshotData = [1, 0];
        reconciliation.reconciliation(player, collisions);

        assert.equal(player.Transform.X, 128);
        for (const collider of player.Colliders) {
            assert.equal(collider.Body.x, player.Transform.X);
            assert.equal(collider.Body.y, player.Transform.Y);
        }
    } finally {
        SharedConfig.ORIGIN = origin;
    }
});

test("reconciliation: idle acknowledgements retire history even without a world update", () => {
    const reconciliation = new Reconciliation();
    const internals = reconciliation as unknown as { inputHistory: InputSnapshot[] };
    for (let id = 1; id <= 100; id++) {
        reconciliation.pushSnapshotToHistory(new InputSnapshot(`${id}=2:0#5:0`));
        reconciliation.LastServerSnapshotData = [id, 0];
    }

    assert.deepEqual(
        internals.inputHistory.map((input) => input.ID),
        [100],
    );
    reconciliation.LastServerSnapshotData = [99, 0];
    assert.deepEqual(
        internals.inputHistory.map((input) => input.ID),
        [100],
    );
});
