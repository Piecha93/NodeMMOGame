import assert from "node:assert/strict";
import { test } from "node:test";
import { V2Prediction } from "../../client/net/V2Prediction";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/SharedConfig";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { InputCommand } from "../../shared/protocol";
import { applySnapshot, captureEntity } from "../../shared/replication/EntityAdapter";
import { commandToSnapshot } from "../../shared/replication/InputCommandAdapter";

test("v2 prediction: authoritative corner correction replays pending commands across sequence wrap without actions", () => {
    const server = new GameCore({ role: Origin.SERVER, fixedDeltaMs: 40 });
    const client = new GameCore({ role: Origin.CLIENT, fixedDeltaMs: 40 });
    try {
        const authority = server.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [115, 115]) as Player;
        const vertical = server.ObjectsFactory.instantiateWithPosition("Wall", [400, 100], [32, 200]);
        vertical.Transform.X = 160;
        vertical.updateColliders();
        const horizontal = server.ObjectsFactory.instantiateWithPosition("Wall", [400, 400], [200, 32]);
        horizontal.Transform.X = 100;
        horizontal.Transform.Y = 160;
        horizontal.updateColliders();
        assert.equal(vertical.IsDestroyed, false);
        assert.equal(horizontal.IsDestroyed, false);
        server.CollisionsSystem.update();
        server.ChunksManager.rebuild();
        applySnapshot(client, {
            serverTick: 0,
            snapshotId: 0,
            lastProcessedInputSeq: null,
            localPlayerState: captureEntity(authority),
            records: [authority, vertical, horizontal].map((object) => ({
                kind: "create" as const,
                state: captureEntity(object),
            })),
        });
        const predicted = client.ObjectsManager.get(authority.ID);
        assert.ok(predicted instanceof Player);
        predicted.Transform.X += 3;
        let localActions = 0;
        predicted.Weapon = {
            use: () => {
                localActions++;
            },
            equip() {},
            hide() {},
        };
        const prediction = new V2Prediction(40);
        const commands: InputCommand[] = [0xfffffffe, 0xffffffff, 0].map((seq) => ({
            seq,
            horizontal: 1,
            vertical: 1,
            actions: [{ kind: "primary", x: 200, y: 200 }],
        }));
        for (const command of commands) {
            prediction.predict(predicted, command);
            client.step();
        }
        const first = commands[0];
        assert.ok(first);
        authority.setInput(commandToSnapshot(first, false));
        server.step();
        prediction.reconcile(
            predicted,
            captureEntity(authority),
            first.seq,
            client.CollisionsSystem,
            client.ChunksManager,
        );
        assert.equal(prediction.PendingCount, 2);
        for (const command of commands.slice(1)) {
            authority.setInput(commandToSnapshot(command, false));
            server.step();
        }
        assert.deepEqual(predicted.Transform.Position, authority.Transform.Position);
        assert.ok(predicted.Transform.X <= 128 && predicted.Transform.Y <= 128);
        assert.equal(localActions, 0);
        prediction.reconcile(predicted, captureEntity(authority), 0, client.CollisionsSystem, client.ChunksManager);
        assert.equal(prediction.PendingCount, 0);
        for (const collider of predicted.Colliders) {
            assert.equal(collider.Body.x, predicted.Transform.X);
            assert.equal(collider.Body.y, predicted.Transform.Y);
        }
    } finally {
        server.dispose();
        client.dispose();
    }
});

test("v2 prediction: exhausted history requires explicit recovery instead of silently dropping inputs", () => {
    const core = new GameCore({ role: Origin.CLIENT });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const prediction = new V2Prediction(core.Runtime.config.fixedDeltaMs);
        for (let seq = 0; seq < 256; seq++) prediction.predict(player, { seq, horizontal: 0, vertical: 1 });
        assert.throws(
            () => prediction.predict(player, { seq: 256, horizontal: 0, vertical: 0 }),
            /resynchronization required/,
        );
        assert.equal(prediction.PendingCount, 256);
    } finally {
        core.dispose();
    }
});

test("v2 prediction: replay applies the authoritative world-edge clamp and reindexes corrected chunks", () => {
    const server = new GameCore({ role: Origin.SERVER, fixedDeltaMs: 40, numOfChunksX: 1, numOfChunksY: 1 });
    const client = new GameCore({ role: Origin.CLIENT, fixedDeltaMs: 40, numOfChunksX: 1, numOfChunksY: 1 });
    try {
        const authority = server.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1270, 100]) as Player;
        applySnapshot(client, {
            serverTick: 0,
            snapshotId: 0,
            lastProcessedInputSeq: null,
            localPlayerState: captureEntity(authority),
            records: [{ kind: "create", state: captureEntity(authority) }],
        });
        const player = client.ObjectsManager.get(authority.ID);
        assert.ok(player instanceof Player);
        const prediction = new V2Prediction(40);
        const commands = [0, 1, 2].map((seq) => ({ seq, horizontal: 0 as const, vertical: 1 as const }));
        for (const command of commands) {
            prediction.predict(player, command);
            client.step();
        }
        const first = commands[0];
        assert.ok(first);
        authority.setInput(commandToSnapshot(first, false));
        server.step();
        prediction.reconcile(player, captureEntity(authority), 0, client.CollisionsSystem, client.ChunksManager);
        assert.equal(authority.Transform.X, 1279);
        assert.equal(player.Transform.X, authority.Transform.X);
        for (const collider of player.Colliders) assert.equal(collider.Body.x, player.Transform.X);
    } finally {
        server.dispose();
        client.dispose();
    }

    const core = new GameCore({ role: Origin.CLIENT, fixedDeltaMs: 40 });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1400, 100]) as Player;
        const prediction = new V2Prediction(40);
        prediction.predict(player, { seq: 1, horizontal: 0, vertical: 1 });
        const correction = captureEntity(player);
        prediction.reconcile(
            player,
            { ...correction, transform: { ...correction.transform, x: 100 } },
            null,
            core.CollisionsSystem,
            core.ChunksManager,
        );
        assert.equal(player.Transform.X, 110);
        assert.equal(core.ChunksManager.getObjectChunk(player), core.ChunksManager.Chunks[0]?.[0]);
    } finally {
        core.dispose();
    }
});
