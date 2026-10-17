import assert from "node:assert/strict";
import { test } from "node:test";
import { AdventureController } from "../../server/runtime/AdventureController";
import { ExpeditionController } from "../../server/runtime/ExpeditionController";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import {
    EXPEDITION,
    VILLAGE_PREPARATION_MS,
    VILLAGE_REST_MS,
    VILLAGE_WAVES,
    isExpeditionState,
} from "../../shared/gameplay/Expedition";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { Player } from "../../shared/game_utils/game/objects/Player";

function fixture() {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true, random: () => 0.5 });
    const expedition = new ExpeditionController(core);
    const adventure = new AdventureController(core);
    expedition.start();
    const update = (delta: number) => {
        expedition.update(delta);
        adventure.update(delta, expedition.state().phase === "active");
        expedition.setEncounterState(adventure.encounterState());
    };
    const join = (name = "Wędrowiec") => {
        const player = core.ObjectsFactory.instantiateWithPosition(
            "DefaultPlayer",
            expedition.spawnPosition(expedition.state().party.length),
        );
        assert.ok(player instanceof Player);
        player.Name = name;
        expedition.join(player);
        adventure.join(player);
        core.Runtime.timeMs += 3100;
        return player;
    };
    return {
        core,
        expedition,
        adventure,
        update,
        join,
        dispose() {
            adventure.dispose();
            expedition.dispose();
            core.dispose();
        },
    };
}

test("expedition: village starts once without fortress quests, caps the party and pauses empty rounds", () => {
    const game = fixture();
    try {
        const initialObjects = game.core.ObjectsManager.ObjectsById.size;
        assert.equal(initialObjects, 1, "the round owns only its home marker; terrain is seeded separately");
        assert.equal(Array.from(game.core.ObjectsManager.ObjectsById.values())[0]?.SpriteName, "portal");
        game.expedition.start();
        assert.equal(game.core.ObjectsManager.ObjectsById.size, initialObjects);
        game.update(5000);
        assert.equal(game.expedition.state().phase, "waiting");
        assert.equal(game.expedition.state().remainingMs, EXPEDITION.durationMs);
        assert.deepEqual(game.expedition.state().camps, []);
        const players = Array.from({ length: EXPEDITION.maxPlayers }, (_, index) => game.join(`Gracz ${index}`));
        assert.equal(new Set(players.map((player) => player.Transform.Position.join(","))).size, 4);
        game.update(2000);
        const elapsed = game.expedition.state().remainingMs;
        assert.equal(elapsed, EXPEDITION.durationMs - 2000);
        const extra = game.core.ObjectsFactory.instantiateWithPosition(
            "DefaultPlayer",
            game.expedition.spawnPosition(4),
        );
        assert.ok(extra instanceof Player);
        assert.throws(() => game.expedition.join(extra), /full/);
        extra.destroy();
        for (const player of players) {
            game.expedition.leave(player.ID);
            game.adventure.leave(player.ID);
            player.destroy();
        }
        game.update(10000);
        assert.equal(game.expedition.state().phase, "waiting");
        assert.equal(game.expedition.state().remainingMs, elapsed);
        game.join();
        game.update(100);
        assert.equal(game.expedition.state().phase, "active");
        assert.equal(game.expedition.state().remainingMs, elapsed - 100);
        assert.ok(isExpeditionState(game.expedition.state()));
    } finally {
        game.dispose();
    }
});

test("expedition: the persistent home marker survives a cold empty-world chunk dump and reload", () => {
    const game = fixture();
    try {
        const chunk = game.core.ChunksManager.getChunkAtPosition(EXPEDITION.home.x, EXPEDITION.home.y);
        assert.ok(chunk);
        assert.equal(game.expedition.state().party.length, 0);
        assert.doesNotThrow(() => chunk.deactivate(), "the visual campfire must use a registered network sprite ID");
        assert.equal(chunk.IsActive, false);
        assert.equal(game.core.ObjectsManager.ObjectsById.size, 0);
        assert.doesNotThrow(() => chunk.activate());
        const markers = Array.from(game.core.ObjectsManager.ObjectsById.values());
        assert.equal(markers.length, 1);
        assert.equal(markers[0]?.SpriteName, "portal");
        assert.equal(markers[0]?.Transform.ScaleX, 112);
        game.expedition.start();
        assert.equal(game.core.ObjectsManager.ObjectsById.size, 1, "start stays idempotent after deserialization");
        game.join();
        game.update(0);
        assert.ok(isExpeditionState(game.expedition.state()));
    } finally {
        game.dispose();
    }
});

test("expedition: clearing six encounters wins wherever the party stands without returning to a fortress", () => {
    const game = fixture();
    try {
        const player = game.join();
        player.Transform.X = 1800;
        player.Transform.Y = 1800;
        game.core.ChunksManager.rebuildOne(player);
        game.update(VILLAGE_PREPARATION_MS);
        for (const [index, amount] of VILLAGE_WAVES.entries()) {
            const enemies = Array.from(game.core.ObjectsManager.objectsOfType(Enemy));
            assert.equal(enemies.length, amount);
            for (const enemy of enemies) enemy.hit(enemy.MaxHP);
            game.update(0);
            assert.equal(game.expedition.state().collected, index + 1);
            assert.equal(game.expedition.state().enemiesRemaining, 0);
            if (index < VILLAGE_WAVES.length - 1) {
                assert.equal(game.expedition.state().phase, "active");
                assert.equal(game.expedition.state().waveStage, "rest");
                game.update(VILLAGE_REST_MS);
            }
        }
        const state = game.expedition.state();
        assert.equal(state.phase, "won");
        assert.equal(state.collected, 6);
        assert.equal(state.total, 6);
        assert.equal(state.kills, 55);
        assert.equal(state.waveStage, "complete");
        assert.ok(Math.hypot(player.Transform.X - EXPEDITION.home.x, player.Transform.Y - EXPEDITION.home.y) > 500);
        assert.ok(isExpeditionState(state));
        const before = state.remainingMs;
        game.update(10000);
        assert.equal(game.expedition.state().remainingMs, before, "a finished round cannot expire into a loss");
    } finally {
        game.dispose();
    }
});

test("expedition: timeout stops the encounter and restart resets waves, timer and existing players", () => {
    const game = fixture();
    try {
        const player = game.join();
        game.update(VILLAGE_PREPARATION_MS);
        const projectile = game.core.ObjectsFactory.instantiateWithPosition("FireBall", player.Transform.Position);
        assert.ok(projectile instanceof FireBall);
        projectile.Owner = player.ID;
        assert.equal(game.expedition.restart(), false);
        player.hit(80);
        game.update(EXPEDITION.durationMs);
        assert.equal(game.expedition.state().phase, "lost");
        assert.equal(game.expedition.state().remainingMs, 0);
        assert.equal(game.expedition.state().kills, 0, "cleanup is not a kill");
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 0);
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(FireBall)).length, 0);
        const count = game.core.ObjectsManager.ObjectsById.size;
        assert.equal(game.expedition.restart(), true);
        game.adventure.reset();
        game.expedition.setEncounterState(game.adventure.encounterState());
        const state = game.expedition.state();
        assert.equal(state.round, 2);
        assert.equal(state.phase, "active");
        assert.equal(state.collected, 0);
        assert.equal(state.kills, 0);
        assert.equal(state.wave, 0);
        assert.equal(state.waveStage, "preparing");
        assert.equal(state.stageRemainingMs, VILLAGE_PREPARATION_MS);
        assert.equal(state.remainingMs, EXPEDITION.durationMs);
        assert.equal(player.HP, player.MaxHP);
        assert.ok(
            Math.hypot(player.Transform.X - EXPEDITION.home.x, player.Transform.Y - EXPEDITION.home.y) <
                EXPEDITION.home.radius,
        );
        assert.equal(game.core.ObjectsManager.get(player.ID), player);
        assert.equal(
            game.core.ObjectsManager.ObjectsById.size,
            count,
            "restart does not recreate terrain or home markers",
        );
        assert.ok(isExpeditionState(state));
    } finally {
        game.dispose();
    }
});

test("expedition: restarting leaves distant terrain asleep and only activates the party neighbourhood", () => {
    const game = fixture();
    try {
        game.join();
        game.core.ChunksManager.deactivateUnusedChunks();
        const distant = game.core.ChunksManager.getChunkAtPosition(5000, 5000);
        assert.ok(distant);
        assert.equal(distant.IsActive, false);
        game.update(EXPEDITION.durationMs);
        assert.equal(game.expedition.restart(), true);
        game.adventure.reset();
        assert.equal(distant.IsActive, false, "a restart has no reason to wake the entire terrain map");
        const home = game.core.ChunksManager.getChunkAtPosition(EXPEDITION.home.x, EXPEDITION.home.y);
        assert.ok(home);
        assert.equal(home.IsActive, true);
    } finally {
        game.dispose();
    }
});

test("expedition: foreign or destroyed players cannot join, even if another world reused their ID", () => {
    const game = fixture();
    const other = new GameCore({ role: Origin.SERVER });
    try {
        const foreign = other.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [640, 640]);
        assert.ok(foreign instanceof Player);
        assert.throws(() => game.expedition.join(foreign), /belong/);
        const player = game.join();
        game.expedition.join(player);
        assert.equal(game.expedition.state().party.length, 1);
        const destroyed = game.core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [640, 640]);
        assert.ok(destroyed instanceof Player);
        destroyed.destroy();
        assert.throws(() => game.expedition.join(destroyed), /belong/);
        assert.throws(() => game.expedition.spawnPosition(-1), /index/);
        assert.throws(() => game.expedition.update(NaN), /delta/);
    } finally {
        game.dispose();
        other.dispose();
    }
});
