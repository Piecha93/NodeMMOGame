import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { ReplicationSession } from "../../shared/replication/ReplicationSession";
import { decodeSnapshot, encodeSnapshot } from "../../shared/protocol";

test("v2 replication: a prepared snapshot changes neither the baseline nor sequence until committed", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [200, 200]);
        const session = new ReplicationSession();
        const first = session.prepare(core, player, null);
        assert.equal(first.snapshot.records.length, 2);
        assert.equal(first.snapshot.snapshotId, 0);
        assert.deepEqual(session.prepare(core, player, null).snapshot, first.snapshot);
        first.commit();
        assert.equal(session.prepare(core, player, null).snapshot.records.length, 0);

        wall.Transform.X = 201;
        wall.Transform.Y = 202;
        wall.Transform.ScaleX = 33;
        wall.Transform.ScaleY = 34;
        wall.Transform.Rotation = 0.5;
        wall.Velocity = 0.2;
        const changed = session.prepare(core, player, 4);
        const update = changed.snapshot.records[0];
        assert.equal(update.kind, "update");
        assert.deepEqual(update.transform, { x: 201, y: 202, scaleX: 33, scaleY: 34, rotation: 0.5 });
        assert.deepEqual(update.fields, { velocity: 0.2 });
        assert.deepEqual(decodeSnapshot(encodeSnapshot(changed.snapshot)).records, changed.snapshot.records);
        assert.deepEqual(session.prepare(core, player, 4).snapshot, changed.snapshot);
        changed.commit();
        assert.equal(session.prepare(core, player, 4).snapshot.records.length, 0);
    } finally {
        core.dispose();
    }
});

test("v2 replication: recipient baselines stay independent and detect transform-only and fields-only updates", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [200, 200]);
        const first = new ReplicationSession();
        const second = new ReplicationSession();
        first.prepare(core, player, null).commit();
        second.prepare(core, player, null).commit();
        wall.Transform.X = 201;
        const movement = first.prepare(core, player, null);
        const record = movement.snapshot.records[0];
        assert.equal(record.kind, "update");
        assert.deepEqual(record.transform, { x: 201 });
        assert.equal(record.fields, undefined);
        movement.commit();
        assert.equal(first.prepare(core, player, null).snapshot.records.length, 0);
        assert.equal(second.prepare(core, player, null).snapshot.records.length, 1);

        wall.Velocity = 0.5;
        const fields = first.prepare(core, player, null).snapshot.records[0];
        assert.equal(fields.kind, "update");
        assert.deepEqual(fields.fields, { velocity: 0.5 });
        assert.equal(fields.transform, undefined);
        assert.equal(movement.snapshot.localPlayerState?.id, player.ID);
    } finally {
        core.dispose();
    }
});

test("v2 replication: leaving interest emits one destroy and returning captures complete current state", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [1400, 500]);
        const session = new ReplicationSession();
        session.prepare(core, player, null).commit();
        wall.Transform.X = 2700;
        core.ChunksManager.rebuild();
        const leave = session.prepare(core, player, null);
        assert.deepEqual(leave.snapshot.records, [{ kind: "destroy", id: wall.ID }]);
        leave.commit();
        assert.equal(session.prepare(core, player, null).snapshot.records.length, 0);
        wall.Velocity = 0.5;
        wall.Transform.X = 1401;
        core.ChunksManager.rebuild();
        const returned = session.prepare(core, player, null);
        const record = returned.snapshot.records[0];
        assert.equal(record.kind, "create");
        assert.equal(record.state.transform.x, 1401);
        assert.equal(record.state.fields.velocity, 0.5);
        returned.commit();
        wall.destroy();
        const destroyed = session.prepare(core, player, null);
        assert.deepEqual(destroyed.snapshot.records, [{ kind: "destroy", id: wall.ID }]);
        destroyed.commit();
        assert.equal(session.prepare(core, player, null).snapshot.records.length, 0);
    } finally {
        core.dispose();
    }
});
