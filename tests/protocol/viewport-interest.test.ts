import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { EntityState } from "../../shared/protocol";
import { ReplicationSession, VIEWPORT_INTEREST } from "../../shared/replication/ReplicationSession";

test("viewport interest: prefetch and hysteresis prevent repeated creates at a moving boundary", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [3200, 3200]) as Player;
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [4050, 3200]);
        assert.equal(wall.IsDestroyed, false);
        const session = new ReplicationSession(VIEWPORT_INTEREST);
        const initial = session.prepare(core, player, null);
        assert.deepEqual(
            initial.snapshot.records.map((record) => record.kind === "create" && record.state.id),
            [player.ID],
        );
        initial.commit();
        wall.Transform.X = 3980;
        const enter = session.prepare(core, player, null);
        assert.equal(enter.snapshot.records[0].kind, "create");
        enter.commit();
        // Outside the entry range, but inside the retention margin.
        wall.Transform.X = 4020;
        const retained = session.prepare(core, player, null);
        assert.equal(retained.snapshot.records[0].kind, "update");
        retained.commit();
        wall.Transform.X = 4095;
        const leave = session.prepare(core, player, null);
        assert.deepEqual(leave.snapshot.records, [{ kind: "destroy", id: wall.ID }]);
        leave.commit();
        assert.equal(session.prepare(core, player, null).snapshot.records.length, 0);
        wall.Transform.X = 3980;
        wall.Velocity = 0.75;
        const returned = session.prepare(core, player, null).snapshot.records[0];
        assert.equal(returned.kind, "create");
        assert.equal(returned.state.fields.velocity, 0.75);
        assert.equal(returned.state.transform.x, 3980);
    } finally {
        core.dispose();
    }
});

test("viewport interest: large rotated scenery is included and legacy snapshot interest remains unchanged", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [3200, 3200]) as Player;
        const scenery = core.ObjectsFactory.instantiateWithPosition("Wall", [4120, 3300], [600, 20]);
        scenery.Transform.Rotation = Math.PI / 4;
        const far = core.ObjectsFactory.instantiateWithPosition("Wall", [4300, 2800]);
        assert.equal(scenery.IsDestroyed, false);
        assert.equal(far.IsDestroyed, false);
        const compact = new ReplicationSession(VIEWPORT_INTEREST).prepare(core, player, null).snapshot;
        const complete = new ReplicationSession().prepare(core, player, null).snapshot;
        const created = compact.records.filter((record) => record.kind === "create").map((record) => record.state.id);
        assert.ok(created.includes(player.ID));
        assert.ok(created.includes(scenery.ID), "large scenery crossing the viewport margin must remain present");
        assert.ok(!created.includes(far.ID));
        assert.equal(complete.records.length, 3, "v2 clients keep their original chunk interest");
        assert.equal(compact.localPlayerState?.id, player.ID);
    } finally {
        core.dispose();
    }
});

test("replication captures: one publication shares immutable entity snapshots across independent recipients", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [3200, 3200]) as Player;
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [3300, 3200]);
        const first = new ReplicationSession();
        const second = new ReplicationSession();
        const captures = new Map<string, EntityState>();
        const one = first.prepare(core, player, null, captures);
        const two = second.prepare(core, player, null, captures);
        assert.equal(captures.size, 2);
        const oneWall = one.snapshot.records.find((record) => record.kind === "create" && record.state.id === wall.ID);
        const twoWall = two.snapshot.records.find((record) => record.kind === "create" && record.state.id === wall.ID);
        assert.equal(oneWall?.kind, "create");
        assert.equal(twoWall?.kind, "create");
        assert.equal(oneWall.state, twoWall.state);
        one.commit();
        wall.Transform.X = 3301;
        const next = first.prepare(core, player, null, new Map());
        assert.equal(next.snapshot.records[0].kind, "update");
        assert.equal(next.snapshot.records[0].transform?.x, 3301);
        assert.equal(oneWall.state.transform.x, 3300, "later publications cannot mutate another recipient baseline");
        assert.equal(
            second.prepare(core, player, null).snapshot.records[0].kind,
            "create",
            "an uncommitted recipient retains its own sequence/baseline",
        );
    } finally {
        core.dispose();
    }
});
