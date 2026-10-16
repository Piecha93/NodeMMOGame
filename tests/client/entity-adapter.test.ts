import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { EntityRecord, EntityState, Snapshot } from "../../shared/protocol";
import { applyEntity, applySnapshot, captureEntity } from "../../shared/replication/EntityAdapter";

function snapshot(records: readonly EntityRecord[], localPlayerState?: EntityState): Snapshot {
    return { serverTick: 1, snapshotId: 1, lastProcessedInputSeq: null, records, localPlayerState };
}

test("replica deltas: a position-only patch preserves all unrelated actor fields and transform values", () => {
    const core = new GameCore({ role: Origin.CLIENT });
    try {
        const actor = core.ObjectsFactory.instantiateWithPosition("Michau", [100, 100], [40, 60]);
        actor.Transform.Rotation = 0.5;
        actor.Velocity = 0.75;
        actor.updateColliders();
        const before = captureEntity(actor);
        applySnapshot(core, snapshot([{ kind: "update", id: actor.ID, prefab: "Michau", transform: { x: 120 } }]));
        const after = captureEntity(actor);
        assert.deepEqual(after.fields, before.fields);
        assert.deepEqual(after.transform, { ...before.transform, x: 120 });
        assert.equal(actor.Colliders[0]?.Body.x, 120);
        assert.equal(actor.Colliders[0]?.Body.y, 100);
    } finally {
        core.dispose();
    }
});

test("replica deltas: runtime preflight rejects the whole batch before earlier updates or creates mutate the world", () => {
    const core = new GameCore({ role: Origin.CLIENT });
    try {
        const actor = core.ObjectsFactory.instantiateWithPosition("Michau", [100, 100]);
        const before = captureEntity(actor);
        const created: EntityState = { ...before, id: "B999" };
        assert.throws(
            () =>
                applySnapshot(
                    core,
                    snapshot([
                        { kind: "update", id: actor.ID, prefab: "Michau", transform: { x: 200 } },
                        { kind: "create", state: created },
                        { kind: "update", id: "B998", prefab: "Michau", fields: { hp: 50 } },
                    ]),
                ),
            /Missing or mismatched/,
        );
        assert.deepEqual(captureEntity(actor), before);
        assert.equal(core.ObjectsManager.get(created.id), undefined);
        assert.equal(actor.Colliders[0]?.Body.x, before.transform.x);
        assert.throws(
            () => applySnapshot(core, snapshot([{ kind: "destroy", id: actor.ID }], { ...before, id: "B998" })),
            /lacks its local player/,
        );
        assert.equal(actor.IsDestroyed, false);
    } finally {
        core.dispose();
    }
});

test("replica deltas: a destroyed id can be recreated and updated inside one validated batch", () => {
    const core = new GameCore({ role: Origin.CLIENT });
    try {
        const original = core.ObjectsFactory.instantiateWithPosition("Michau", [100, 100]);
        const replacement = captureEntity(original);
        applySnapshot(
            core,
            snapshot([
                { kind: "destroy", id: original.ID },
                { kind: "create", state: replacement },
                { kind: "update", id: original.ID, prefab: "Michau", transform: { x: 1400, y: 400 } },
            ]),
        );
        const current = core.ObjectsManager.get(original.ID);
        assert.ok(current);
        assert.notEqual(current, original);
        assert.equal(original.IsDestroyed, true);
        assert.deepEqual(current.Transform.Position, [1400, 400]);
        assert.equal(current.Colliders[0]?.Body.x, 1400);
        assert.equal(core.ChunksManager.getObjectChunk(current), core.ChunksManager.getChunkAtPosition(1400, 400));
        assert.equal(core.ChunksManager.getChunkAtPosition(100, 100)?.Objects.includes(original), false);
    } finally {
        core.dispose();
    }
});

test("replica deltas: authoritative local state overrides a record before final collider and chunk publication", () => {
    const core = new GameCore({ role: Origin.CLIENT });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        const authority = captureEntity(player);
        const local: EntityState = {
            ...authority,
            fields: { ...authority.fields, hp: 45 },
            transform: { ...authority.transform, x: 1400, y: 400, scaleX: 48, scaleY: 64, rotation: 0.7 },
        };
        applySnapshot(
            core,
            snapshot(
                [{ kind: "update", id: player.ID, prefab: "DefaultPlayer", transform: { x: 200 }, fields: { hp: 80 } }],
                local,
            ),
        );
        assert.deepEqual(captureEntity(player), local);
        assert.equal(player.Colliders[0]?.Body.x, local.transform.x);
        assert.equal(player.Colliders[0]?.Body.y, local.transform.y);
        assert.equal(player.Colliders[0]?.Rotation, local.transform.rotation);
        assert.equal(core.ChunksManager.getObjectChunk(player), core.ChunksManager.getChunkAtPosition(1400, 400));
    } finally {
        core.dispose();
    }
});

test("replica deltas: out-of-bounds authoritative movement publishes the final clamped collider", () => {
    const core = new GameCore({ role: Origin.CLIENT, numOfChunksX: 1, numOfChunksY: 1 });
    try {
        const actor = core.ObjectsFactory.instantiateWithPosition("Michau", [100, 100]);
        applySnapshot(
            core,
            snapshot([{ kind: "update", id: actor.ID, prefab: "Michau", transform: { x: 2000, y: -20 } }]),
        );
        assert.deepEqual(actor.Transform.Position, [1279, 1]);
        assert.equal(actor.Colliders[0]?.Body.x, 1279);
        assert.equal(actor.Colliders[0]?.Body.y, 1);
        assert.equal(core.ChunksManager.getObjectChunk(actor), core.ChunksManager.getChunkAtPosition(1279, 1));
    } finally {
        core.dispose();
    }
});

test("replica full state: applying an equal transform still synchronizes previously stale geometry for prediction", () => {
    const core = new GameCore({ role: Origin.CLIENT });
    try {
        const actor = core.ObjectsFactory.instantiateWithPosition("Michau", [100, 100]);
        actor.Transform.X = 130;
        assert.equal(actor.Colliders[0]?.Body.x, 100);
        applyEntity(actor, captureEntity(actor));
        assert.equal(actor.Colliders[0]?.Body.x, 130);
    } finally {
        core.dispose();
    }
});
