import assert from "node:assert/strict";
import { test } from "node:test";
import { AdventureController } from "../../server/runtime/AdventureController";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { ADVENTURE_MAX_LEVEL, createAdventureBuild, isAdventureState } from "../../shared/gameplay/Adventure";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { ExpeditionMarker } from "../../shared/game_utils/game/objects/ExpeditionMarker";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { MouseKeys } from "../../shared/input/InputCommands";

function fixture() {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true, random: () => 0.5 });
    const adventure = new AdventureController(core);
    const join = (position: [number, number] = [640, 640]) => {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", position);
        assert.ok(player instanceof Player);
        adventure.join(player);
        return player;
    };
    const enemy = (position: [number, number] = [640, 640]) => {
        const object = core.ObjectsFactory.instantiateWithPosition("Michau", position);
        assert.ok(object instanceof Enemy);
        return object;
    };
    const kill = (position?: [number, number]) => {
        const object = enemy(position);
        object.hit(object.MaxHP);
        object.destroy();
        return object;
    };
    const drops = () =>
        Array.from(core.ObjectsManager.ObjectsById.values()).filter(
            (object) => object instanceof ExpeditionMarker && object.SpriteName.startsWith("loot_"),
        );
    const progress = (player: Player) => {
        const state = adventure.state().players.find((entry) => entry.id === player.ID);
        assert.ok(state);
        return state;
    };
    const collectKills = (count: number) => {
        for (let index = 0; index < count; index++) {
            kill();
            adventure.update(0);
        }
    };
    return {
        core,
        adventure,
        join,
        enemy,
        kill,
        drops,
        progress,
        collectKills,
        dispose() {
            adventure.dispose();
            core.dispose();
        },
    };
}

test("adventure: authoritative shared pickups level every teammate and cannot reward a death twice", () => {
    const game = fixture();
    try {
        const first = game.join();
        const second = game.join([650, 640]);
        const defeated = game.kill();
        defeated.destroy();
        game.adventure.update(0);
        for (const player of [first, second]) {
            assert.equal(game.progress(player).xp, 10);
            assert.equal(game.progress(player).coins, 1);
        }
        game.adventure.update(0);
        assert.equal(game.progress(first).xp, 10);
        game.collectKills(1);
        assert.equal(game.progress(first).level, 2);
        assert.equal(game.progress(first).xp, 0);
        assert.equal(game.progress(first).xpToNext, 35);
        assert.equal(game.progress(second).points, 1);
        assert.ok(isAdventureState(game.adventure.state()));
        const late = game.join();
        assert.equal(game.progress(late).level, 1, "late joiners start their own run progression");
    } finally {
        game.dispose();
    }
});

test("adventure: party membership is idempotent, bounded and restricted to living objects in its own world", () => {
    const game = fixture();
    const other = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const first = game.join();
        game.adventure.join(first);
        assert.equal(game.adventure.state().players.length, 1);
        const foreign = other.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [640, 640]);
        assert.ok(foreign instanceof Player);
        assert.equal(foreign.ID, first.ID, "separate worlds may reuse their local object IDs");
        assert.throws(() => game.adventure.join(foreign), /belong/);
        const destroyed = game.core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [640, 640]);
        assert.ok(destroyed instanceof Player);
        destroyed.destroy();
        assert.throws(() => game.adventure.join(destroyed), /belong/);
        game.join();
        game.join();
        game.join();
        const extra = game.core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [640, 640]);
        assert.ok(extra instanceof Player);
        assert.throws(() => game.adventure.join(extra), /full/);
        assert.equal(game.adventure.state().players.length, 4);
    } finally {
        game.dispose();
        other.dispose();
    }
});

test("adventure: forged upgrades and locked weapons cannot spend points or mutate builds", () => {
    const game = fixture();
    try {
        const player = game.join();
        for (const value of [null, [], {}, "__proto__", "constructor", "power\u0000"]) {
            assert.equal(game.adventure.chooseUpgrade(player.ID, value), false);
            assert.equal(game.adventure.chooseWeapon(player.ID, value), false);
        }
        assert.equal(game.adventure.chooseWeapon(player.ID, "scatter"), false);
        assert.equal(game.adventure.chooseWeapon(player.ID, "lance"), false);
        assert.equal(game.adventure.chooseUpgrade("missing", "power"), false);
        assert.equal(game.adventure.chooseUpgrade(player.ID, "power"), false);
        game.collectKills(2);
        assert.equal(game.adventure.chooseWeapon(player.ID, "scatter"), true);
        assert.equal(game.adventure.chooseWeapon(player.ID, "scatter"), false);
        assert.equal(game.adventure.chooseWeapon(player.ID, "lance"), false);
        assert.equal(game.adventure.chooseUpgrade(player.ID, "vitality"), true);
        assert.equal(player.MaxHP, 230);
        assert.equal(game.adventure.chooseUpgrade(player.ID, "power"), false);
        game.collectKills(4);
        assert.equal(game.adventure.chooseWeapon(player.ID, "lance"), true);
        assert.equal(game.progress(player).level, 3);
        assert.equal(game.progress(player).xp, 5);
        assert.ok(isAdventureState(game.adventure.state()));
    } finally {
        game.dispose();
    }
});

test("adventure: upgrade ranks and the level cap remain bounded over a long run", () => {
    const game = fixture();
    try {
        const player = game.join();
        game.collectKills(35);
        for (let rank = 0; rank < 5; rank++) assert.equal(game.adventure.chooseUpgrade(player.ID, "power"), true);
        const unspent = game.progress(player).points;
        assert.ok(unspent > 0);
        assert.equal(game.adventure.chooseUpgrade(player.ID, "power"), false);
        assert.equal(game.progress(player).points, unspent);
        game.collectKills(320);
        assert.equal(game.progress(player).level, ADVENTURE_MAX_LEVEL);
        assert.equal(game.progress(player).xp, 0);
        assert.equal(game.progress(player).xpToNext, 0);
        assert.equal(game.progress(player).points, ADVENTURE_MAX_LEVEL - 1 - 5);
        assert.ok(isAdventureState(game.adventure.state()));
        assert.deepEqual(createAdventureBuild("ember", { power: 5, haste: 5, vitality: 5, stride: 5 }), {
            weapon: "ember",
            damageMultiplier: 1.9,
            cooldownMultiplier: 0.6,
            movementMultiplier: 1.25,
            maxHp: 350,
        });
    } finally {
        game.dispose();
    }
});

test("adventure: drops attract nearby players, heal only living injured collectors and expire", () => {
    const game = fixture();
    try {
        const player = game.join();
        game.kill([750, 640]);
        game.adventure.update(0);
        const xp = game.drops().find((object) => object.SpriteName === "loot_xp");
        assert.ok(xp);
        const initialX = xp.Transform.X;
        game.adventure.update(100);
        assert.ok(xp.Transform.X < initialX, "the magnet animates toward the player");
        game.adventure.update(100);
        game.adventure.update(0);
        assert.equal(game.progress(player).xp, 10);
        game.collectKills(3);
        player.hit(80);
        const damaged = player.HP;
        game.collectKills(1);
        assert.equal(player.HP, damaged + 45);
        game.kill([1800, 1800]);
        game.adventure.update(0);
        assert.ok(game.drops().length > 0);
        game.adventure.update(60_000);
        assert.equal(game.drops().length, 0);
    } finally {
        game.dispose();
    }
});

test("adventure: dead players cannot collect and living chunk unloads never generate rewards", () => {
    const game = fixture();
    try {
        const player = game.join();
        player.hit(player.MaxHP);
        game.kill();
        game.adventure.update(0);
        assert.equal(game.progress(player).xp, 0);
        assert.equal(game.drops().length, 2);
        player.respawn();
        game.adventure.update(0);
        assert.equal(game.progress(player).xp, 10);
        game.enemy([1800, 1800]);
        const chunk = game.core.ChunksManager.getChunkAtPosition(1800, 1800);
        assert.ok(chunk);
        chunk.deactivate();
        game.adventure.update(0);
        assert.equal(game.drops().length, 0);
        assert.equal(game.progress(player).xp, 10);
    } finally {
        game.dispose();
    }
});

test("adventure: loot cannot resurrect from a sleeping chunk, including a death during unload", () => {
    const game = fixture();
    try {
        game.join();
        game.kill([1800, 1800]);
        game.adventure.update(0);
        assert.equal(game.drops().length, 2);
        const enemy = game.enemy([1800, 1800]);
        enemy.hit(enemy.MaxHP);
        const chunk = game.core.ChunksManager.getChunkAtPosition(1800, 1800);
        assert.ok(chunk);
        chunk.deactivate();
        game.adventure.update(0);
        assert.equal(game.drops().length, 0);
        chunk.activate();
        game.adventure.update(0);
        assert.equal(game.drops().length, 0);
    } finally {
        game.dispose();
    }
});

test("adventure: first waves are nearby, active, paced and bounded even for a large delta", () => {
    const game = fixture();
    try {
        game.adventure.update(10_000);
        assert.equal(game.adventure.state().wave, 0, "empty parties pause the wave clock");
        const player = game.join();
        game.adventure.update(2999);
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 0);
        game.adventure.update(1);
        const first = Array.from(game.core.ObjectsManager.objectsOfType(Enemy));
        assert.equal(first.length, 3);
        for (const enemy of first) {
            assert.equal(enemy.MaxHP, 70);
            assert.equal(enemy.SpriteName, "wraith_idle");
            assert.ok(
                Math.hypot(enemy.Transform.X - player.Transform.X, enemy.Transform.Y - player.Transform.Y) >= 329,
            );
            assert.equal(game.core.ChunksManager.getObjectChunk(enemy)?.IsActive, true);
        }
        game.adventure.update(120_000);
        assert.equal(game.adventure.state().wave, 2, "a pause cannot catch up a dozen encounters at once");
        for (let index = 0; index < 30; index++) game.adventure.update(12_000);
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 32);
        assert.ok(isAdventureState(game.adventure.state()));
    } finally {
        game.dispose();
    }
});

test("adventure: waves leave sleeping chunks asleep and drops remain collectible at a world edge", () => {
    const core = new GameCore({
        role: Origin.SERVER,
        cooperative: true,
        chunkSize: 128,
        numOfChunksX: 8,
        numOfChunksY: 8,
        random: () => 0.5,
    });
    const adventure = new AdventureController(core);
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [512, 512]);
        assert.ok(player instanceof Player);
        adventure.join(player);
        core.Runtime.timeMs = 2000;
        core.ChunksManager.deactivateUnusedChunks();
        adventure.update(3000);
        assert.equal(
            Array.from(core.ObjectsManager.objectsOfType(Enemy)).length,
            0,
            "distant spawn points cannot wake sleeping chunks",
        );
        for (const chunk of core.ChunksManager.ChunksIterator()) chunk.activate();
        adventure.update(12_000);
        const wave = Array.from(core.ObjectsManager.objectsOfType(Enemy));
        assert.equal(wave.length, 3);
        assert.ok(
            wave.every(
                (enemy) =>
                    enemy.Transform.X >= 0 &&
                    enemy.Transform.Y >= 0 &&
                    enemy.Transform.X <= 992 &&
                    enemy.Transform.Y <= 992,
            ),
        );
        player.Transform.X = 0;
        player.Transform.Y = 0;
        player.updateColliders();
        core.ChunksManager.rebuildOne(player);
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [0, 0]);
        assert.ok(enemy instanceof Enemy);
        enemy.hit(enemy.MaxHP);
        enemy.destroy();
        adventure.update(0);
        assert.equal(adventure.state().players[0]?.xp, 10, "negative loot offsets are clamped into the map");
        assert.equal(adventure.state().players[0]?.coins, 1);
    } finally {
        adventure.dispose();
        core.dispose();
    }
});

test("adventure: ground drops are capped, and reset clears encounters and progression without cleanup rewards", () => {
    const game = fixture();
    try {
        const player = game.join();
        game.collectKills(2);
        game.adventure.chooseUpgrade(player.ID, "vitality");
        game.adventure.chooseWeapon(player.ID, "scatter");
        for (let index = 0; index < 100; index++) game.kill([1800, 1800]);
        game.adventure.update(3000);
        assert.equal(game.drops().length, 128);
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 3);
        game.adventure.reset();
        assert.equal(game.drops().length, 0);
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 0);
        assert.equal(player.MaxHP, 200);
        assert.equal(game.adventure.state().round, 2);
        assert.equal(game.progress(player).level, 1);
        assert.equal(game.progress(player).coins, 0);
        assert.equal(game.progress(player).weapon, "ember");
        game.adventure.update(0);
        assert.equal(game.progress(player).xp, 0);
        assert.equal(game.drops().length, 0);
    } finally {
        game.dispose();
    }
});

test("adventure: stopping, disconnecting and disposal remove owned encounters and suppress rewards", () => {
    const game = fixture();
    try {
        const player = game.join();
        game.adventure.update(3000);
        const enemy = Array.from(game.core.ObjectsManager.objectsOfType(Enemy))[0];
        assert.ok(enemy);
        enemy.hit(enemy.MaxHP);
        game.adventure.update(1, false);
        assert.equal(game.progress(player).xp, 0);
        assert.equal(game.drops().length, 0);
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 0);
        assert.equal(game.adventure.chooseWeapon(player.ID, "scatter"), false);
        game.adventure.reset();
        game.adventure.update(3000);
        game.adventure.leave(player.ID);
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 0);
        assert.equal(game.adventure.state().players.length, 0);
        game.adventure.join(player);
        game.adventure.update(12_000);
        game.adventure.dispose();
        game.adventure.dispose();
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(Enemy)).length, 0);
        assert.throws(() => game.adventure.update(1), /disposed/);
        assert.throws(() => game.adventure.join(player), /disposed/);
    } finally {
        game.dispose();
    }
});

test("adventure: all encounter cleanup paths remove shots even after their wave enemy owner dies", () => {
    for (const cleanup of ["stop", "reset", "leave", "dispose"] as const) {
        const game = fixture();
        try {
            const player = game.join();
            game.adventure.update(3000);
            const enemy = Array.from(game.core.ObjectsManager.objectsOfType(Enemy))[0];
            assert.ok(enemy);
            enemy.Weapon?.use(enemy, player.Transform.Position, MouseKeys.LEFT);
            const projectile = Array.from(game.core.ObjectsManager.objectsOfType(FireBall))[0];
            assert.ok(projectile);
            assert.equal(projectile.Owner, enemy.ID);
            enemy.hit(enemy.MaxHP);
            enemy.destroy();
            assert.equal(projectile.IsDestroyed, false, "an active round allows a defeated enemy's shot to finish");
            if (cleanup === "stop") game.adventure.update(0, false);
            else if (cleanup === "reset") game.adventure.reset();
            else if (cleanup === "leave") game.adventure.leave(player.ID);
            else game.adventure.dispose();
            assert.equal(projectile.IsDestroyed, true, `${cleanup} cannot leave hostile shots in the world`);
            assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(FireBall)).length, 0);
        } finally {
            game.dispose();
        }
    }
});

test("adventure: encounter cleanup only owns wave projectiles and tolerates shots already destroyed", () => {
    const game = fixture();
    try {
        const player = game.join();
        game.adventure.update(3000);
        const enemy = Array.from(game.core.ObjectsManager.objectsOfType(Enemy))[0];
        assert.ok(enemy);
        enemy.Weapon?.use(enemy, player.Transform.Position, MouseKeys.LEFT);
        const hostile = Array.from(game.core.ObjectsManager.objectsOfType(FireBall))[0];
        assert.ok(hostile);
        hostile.destroy();
        player.Weapon?.use(player, [900, 640], MouseKeys.LEFT);
        const friendly = Array.from(game.core.ObjectsManager.objectsOfType(FireBall))[0];
        assert.ok(friendly);
        assert.equal(friendly.Owner, player.ID);
        game.adventure.reset();
        assert.equal(friendly.IsDestroyed, false, "the expedition controller owns player and camp-guard cleanup");
        assert.equal(Array.from(game.core.ObjectsManager.objectsOfType(FireBall)).length, 1);
    } finally {
        game.dispose();
    }
});

test("adventure: state validation rejects malformed and impossible progression and accepts detached snapshots", () => {
    const game = fixture();
    try {
        game.join();
        const state = game.adventure.state();
        assert.ok(isAdventureState(state));
        const player = state.players[0];
        assert.ok(player);
        for (const value of [
            null,
            [],
            { ...state, wave: NaN },
            { ...state, nextWaveInMs: Infinity },
            { ...state, players: [player, player] },
            { ...state, players: [{ ...player, level: 21 }] },
            { ...state, players: [{ ...player, points: 1 }] },
            { ...state, players: [{ ...player, weapon: "lance" }] },
            { ...state, players: [{ ...player, xp: 20 }] },
            { ...state, players: [{ ...player, upgrades: { ...player.upgrades, power: 0.5 } }] },
            { ...state, players: [{ ...player, upgrades: { ...player.upgrades, unknown: 0 } }] },
        ])
            assert.equal(isAdventureState(value), false);
        (player.upgrades as Record<string, number>).power = 5;
        assert.equal(game.adventure.state().players[0]?.upgrades.power, 0);
        assert.throws(() => game.adventure.update(-1), /delta/);
        assert.throws(() => game.adventure.update(NaN), /delta/);
    } finally {
        game.dispose();
    }
    const performance = new GameCore({ role: Origin.SERVER, performanceMode: true });
    try {
        assert.throws(() => new AdventureController(performance), /ordinary/);
    } finally {
        performance.dispose();
    }
});
