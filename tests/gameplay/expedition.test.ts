import assert from "node:assert/strict";
import { test } from "node:test";
import { ExpeditionController } from "../../server/runtime/ExpeditionController";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { EXPEDITION, isExpeditionState } from "../../shared/gameplay/Expedition";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Item } from "../../shared/game_utils/game/objects/Item";
import { Player } from "../../shared/game_utils/game/objects/Player";

function fixture() {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true, random: () => 0.5 });
    const expedition = new ExpeditionController(core);
    expedition.start();
    const objects = <T extends GameObject>(type: abstract new (...args: never[]) => T): T[] =>
        Array.from(core.ObjectsManager.ObjectsById.values()).filter((object): object is T => object instanceof type);
    const join = (name = "Wędrowiec") => {
        const player = core.ObjectsFactory.instantiateWithPosition(
            "DefaultPlayer",
            expedition.spawnPosition(expedition.state().party.length),
        );
        assert.ok(player instanceof Player);
        player.Name = name;
        expedition.join(player);
        // These tests exercise round rules after the spawn protection window.
        core.Runtime.timeMs += 3100;
        return player;
    };
    const move = (player: Player, position: { readonly x: number; readonly y: number }) => {
        player.Transform.X = position.x;
        player.Transform.Y = position.y;
        player.updateColliders();
        core.ChunksManager.rebuildOne(player);
    };
    const guardsAt = (camp: (typeof EXPEDITION.camps)[number]) =>
        objects(Enemy).filter((enemy) => Math.hypot(enemy.Transform.X - camp.x, enemy.Transform.Y - camp.y) < 300);
    const clearCamp = (player: Player, camp: (typeof EXPEDITION.camps)[number]) => {
        move(player, camp);
        expedition.update(1);
        const guards = guardsAt(camp);
        assert.equal(guards.length, 3);
        for (const enemy of guards) enemy.hit(enemy.MaxHP);
        expedition.update(1);
    };
    return {
        core,
        expedition,
        objects,
        join,
        move,
        guardsAt,
        clearCamp,
        dispose() {
            expedition.dispose();
            core.dispose();
        },
    };
}

test("expedition: deterministic ruins wait for players, cap the party and pause an empty round", () => {
    const game = fixture();
    try {
        const initialObjects = game.core.ObjectsManager.ObjectsById.size;
        game.expedition.start();
        assert.equal(game.core.ObjectsManager.ObjectsById.size, initialObjects, "start must not duplicate the map");
        assert.ok(initialObjects < 100, "the slice uses authored ruins rather than a random wall field");
        assert.equal(game.objects(Enemy).length, 0);
        game.expedition.update(5000);
        assert.equal(game.expedition.state().phase, "waiting");
        assert.equal(game.expedition.state().remainingMs, EXPEDITION.durationMs);

        const players = Array.from({ length: EXPEDITION.maxPlayers }, (_, index) => game.join(`Gracz ${index}`));
        assert.equal(new Set(players.map((player) => player.Transform.Position.join(","))).size, 4);
        game.expedition.update(2000);
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
            player.destroy();
        }
        game.expedition.update(10000);
        assert.equal(game.expedition.state().phase, "waiting");
        assert.equal(game.expedition.state().remainingMs, elapsed);
        game.join();
        game.expedition.update(100);
        assert.equal(game.expedition.state().phase, "active");
        assert.equal(game.expedition.state().remainingMs, elapsed - 100);
        assert.ok(isExpeditionState(game.expedition.state()));
    } finally {
        game.dispose();
    }
});

test("expedition: every guard is required, cores collect once for the party and victory requires returning home", () => {
    const game = fixture();
    try {
        const first = game.join("Pierwszy");
        const second = game.join("Drugi");
        const camp = EXPEDITION.camps[0];
        assert.ok(camp);
        game.move(first, camp);
        game.move(second, camp);
        game.expedition.update(1);
        const guards = game.guardsAt(camp);
        assert.equal(guards.length, 3);
        guards[0]?.hit(100);
        guards[1]?.hit(100);
        game.expedition.update(1);
        assert.equal(game.expedition.state().collected, 0);
        assert.equal(game.expedition.state().camps[0]?.guardsRemaining, 1);
        guards[2]?.hit(100);
        game.expedition.update(1);
        assert.equal(game.expedition.state().collected, 1);
        assert.equal(game.expedition.state().kills, 3);
        game.expedition.update(1);
        assert.equal(game.expedition.state().collected, 1, "simultaneous players cannot claim a core twice");
        game.move(second, EXPEDITION.home);
        for (const nextCamp of EXPEDITION.camps.slice(1)) game.clearCamp(first, nextCamp);
        assert.equal(game.expedition.state().collected, 3);
        assert.equal(game.expedition.state().kills, 9);
        assert.equal(
            game.expedition.state().phase,
            "active",
            "a teammate waiting at home cannot finish before the carrier returns",
        );
        game.move(first, EXPEDITION.home);
        game.expedition.update(1);
        assert.equal(game.expedition.state().phase, "won", "the entire living party must return together");
        assert.equal(game.objects(Enemy).length, 0);
    } finally {
        game.dispose();
    }
});

test("expedition: three recovered cores alone do not win and a dead player cannot collect or return", () => {
    const game = fixture();
    try {
        const player = game.join();
        const camp = EXPEDITION.camps[0];
        assert.ok(camp);
        game.move(player, { x: camp.x + 150, y: camp.y });
        game.expedition.update(1);
        for (const guard of game.guardsAt(camp)) guard.hit(100);
        player.hit(player.MaxHP);
        game.move(player, camp);
        game.expedition.update(1);
        assert.equal(game.expedition.state().collected, 0);
        assert.equal(game.expedition.state().camps[0]?.status, "ready");
        player.respawn();
        game.move(player, camp);
        game.expedition.update(1);
        for (const nextCamp of EXPEDITION.camps.slice(1)) game.clearCamp(player, nextCamp);
        assert.equal(game.expedition.state().collected, 3);
        assert.equal(game.expedition.state().phase, "active");
        game.core.Runtime.timeMs += 3100;
        player.hit(player.MaxHP);
        game.move(player, EXPEDITION.home);
        game.expedition.update(1);
        assert.equal(game.expedition.state().phase, "active");
        player.respawn();
        game.expedition.update(1);
        assert.equal(game.expedition.state().phase, "won");
    } finally {
        game.dispose();
    }
});

test("expedition: sleeping chunks preserve guard damage and defeats without awarding unload kills", () => {
    const game = fixture();
    try {
        const player = game.join();
        const camp = EXPEDITION.camps[0];
        assert.ok(camp);
        game.move(player, camp);
        game.expedition.update(1);
        const guards = game.guardsAt(camp);
        assert.equal(guards.length, 3);
        const wounded = guards[0];
        const defeated = guards[1];
        assert.ok(wounded && defeated);
        wounded.hit(25);
        defeated.hit(defeated.MaxHP);
        game.expedition.update(1);
        const woundedPosition = wounded.Transform.Position;
        const oldIds = guards.map((guard) => guard.ID);
        game.move(player, EXPEDITION.home);
        const chunk = game.core.ChunksManager.getObjectChunk(wounded);
        assert.ok(chunk);
        chunk.deactivate();
        assert.equal(game.expedition.state().kills, 1);
        assert.equal(game.expedition.state().camps[0]?.guardsRemaining, 2);
        game.move(player, camp);
        game.expedition.update(1);
        const restored = game.guardsAt(camp);
        assert.equal(restored.length, 2);
        assert.ok(restored.every((guard) => !oldIds.includes(guard.ID)));
        assert.equal(
            restored.find((guard) => guard.Transform.Position.join(",") === woundedPosition.join(","))?.HP,
            75,
        );
        assert.equal(game.expedition.state().kills, 1);
    } finally {
        game.dispose();
    }
});

test("expedition: a lost round stops combat and restart resets objectives, timer and players without duplicating ruins", () => {
    const game = fixture();
    try {
        const player = game.join();
        const camp = EXPEDITION.camps[0];
        assert.ok(camp);
        game.move(player, { x: camp.x + 200, y: camp.y });
        game.expedition.update(1);
        for (const guard of game.guardsAt(camp)) guard.hit(100);
        game.expedition.update(1);
        assert.equal(game.expedition.state().camps[0]?.status, "ready");
        const coreMarker = Array.from(game.core.ObjectsManager.ObjectsById.values()).find(
            (object) => object.SpriteName === "bluebolt",
        );
        assert.ok(coreMarker);
        const coreId = coreMarker.ID;
        game.move(player, EXPEDITION.home);
        const markerChunk = game.core.ChunksManager.getObjectChunk(coreMarker);
        assert.ok(markerChunk);
        markerChunk.deactivate();
        const projectile = game.core.ObjectsFactory.instantiateWithPosition("FireBall", player.Transform.Position);
        assert.ok(projectile instanceof FireBall);
        projectile.Owner = player.ID;
        assert.equal(game.expedition.restart(), false);
        game.expedition.update(EXPEDITION.durationMs);
        assert.equal(game.expedition.state().phase, "lost");
        assert.equal(game.expedition.state().remainingMs, 0);
        assert.equal(game.expedition.state().kills, 3, "finishing a round must not award cleanup kills");
        assert.equal(game.objects(Enemy).length, 0);
        assert.equal(game.objects(FireBall).length, 0);
        const wallsBefore = Array.from(game.core.ObjectsManager.ObjectsById.values()).filter(
            (object) => object.SpriteName === "wall",
        ).length;
        assert.equal(game.expedition.restart(), true);
        const state = game.expedition.state();
        assert.equal(state.round, 2);
        assert.equal(state.phase, "active");
        assert.equal(state.collected, 0);
        assert.equal(state.kills, 0);
        assert.equal(state.remainingMs, EXPEDITION.durationMs);
        assert.ok(state.camps.every((entry) => entry.status === "guarded" && entry.guardsRemaining === 3));
        assert.equal(player.HP, player.MaxHP);
        assert.ok(
            Math.hypot(player.Transform.X - EXPEDITION.home.x, player.Transform.Y - EXPEDITION.home.y) <
                EXPEDITION.home.radius,
        );
        assert.equal(
            game.core.ObjectsManager.get(coreId),
            undefined,
            "a sleeping old core must be removed before the next round",
        );
        const wallsAfter = Array.from(game.core.ObjectsManager.ObjectsById.values()).filter(
            (object) => object.SpriteName === "wall",
        ).length;
        assert.ok(wallsAfter >= wallsBefore, "restart reloads sleeping ruins without seeding duplicates");
        assert.equal(wallsAfter, 68);
        game.expedition.leave(player.ID);
        game.expedition.update(EXPEDITION.durationMs);
        assert.equal(game.expedition.state().phase, "waiting");
    } finally {
        game.dispose();
    }
});

test("expedition: unused potions return after unload while consumed potions remain consumed", () => {
    const game = fixture();
    try {
        const player = game.join();
        const camp = EXPEDITION.camps[0];
        assert.ok(camp);
        game.move(player, camp);
        game.expedition.update(1);
        const potions = game.objects(Item);
        assert.equal(potions.length, 2);
        const potion = potions[0];
        assert.ok(potion);
        player.hit(50);
        const damagedHp = player.HP;
        const playerCollider = player.Colliders[0];
        const potionCollider = potion.Colliders[0];
        assert.ok(playerCollider && potionCollider);
        potion.onCollisionEnter({ ColliderA: potionCollider, ColliderB: playerCollider, Result: {} } as never);
        assert.equal(player.HP, damagedHp + 50);
        assert.equal(potion.Consumed, true);
        game.move(player, EXPEDITION.home);
        const leftover = game.objects(Item)[0];
        assert.ok(leftover);
        game.core.ChunksManager.getObjectChunk(leftover)?.deactivate();
        game.move(player, camp);
        game.expedition.update(1);
        assert.equal(game.objects(Item).length, 1);
    } finally {
        game.dispose();
    }
});

test("expedition: restarting a round restores deactivation timers for distant chunks", () => {
    const game = fixture();
    try {
        game.join();
        game.core.ChunksManager.deactivateUnusedChunks();
        const distant = game.core.ChunksManager.getChunkAtPosition(5000, 5000);
        assert.ok(distant);
        assert.equal(distant.IsActive, false);
        game.expedition.update(EXPEDITION.durationMs);
        assert.equal(game.expedition.restart(), true);
        assert.equal(distant.IsActive, true, "restart reloads sleeping objects before cleanup");
        game.core.Runtime.timeMs += game.core.Runtime.config.chunkDeactivationTime + 1;
        game.core.ChunksManager.deactivateUnusedChunks();
        assert.equal(distant.IsActive, false, "restart must not keep the entire world active permanently");
        const home = game.core.ChunksManager.getChunkAtPosition(EXPEDITION.home.x, EXPEDITION.home.y);
        assert.ok(home);
        assert.equal(home.IsActive, true, "the party's current area stays active");
    } finally {
        game.dispose();
    }
});
