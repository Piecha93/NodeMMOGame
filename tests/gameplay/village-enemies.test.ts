import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/SharedConfig";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { villageLineClear, villageWaypoint } from "../../shared/gameplay/VillageNavigation";
import { isVillageWalkable } from "../../shared/gameplay/VillageMap";

test("village combat: runners bite only in range, respect their cooldown and never shoot", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [640, 640]) as Player;
        const runner = core.ObjectsFactory.instantiateWithPosition("Michau", [610, 640]) as Enemy;
        runner.configureAdventure("runner");
        assert.equal(runner.MaxHP, 45);
        runner.update(0);
        assert.equal(player.HP, 200);
        core.Runtime.timeMs = 700;
        runner.update(0);
        assert.equal(player.HP, 188);
        runner.update(0);
        assert.equal(player.HP, 188);
        core.Runtime.timeMs = 1550;
        runner.update(0);
        assert.equal(player.HP, 176);
        player.Transform.X = 700;
        core.Runtime.timeMs = 3000;
        runner.update(0);
        assert.equal(player.HP, 176);
        assert.equal(Array.from(core.ObjectsManager.objectsOfType(FireBall)).length, 0);
    } finally {
        core.dispose();
    }
});

test("village combat: ranged shots are slower and the final heavy enemy emits a bounded ring", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [640, 640]);
        const ranged = core.ObjectsFactory.instantiateWithPosition("Michau", [500, 640]) as Enemy;
        ranged.configureAdventure("ranged");
        assert.equal(ranged.MaxHP, 80);
        core.Runtime.timeMs = 700;
        ranged.update(0);
        const shot = Array.from(core.ObjectsManager.objectsOfType(FireBall))[0];
        assert.ok(shot);
        assert.equal(shot.Power, 14);
        assert.equal(shot.Velocity, 0.33);
        ranged.update(0);
        assert.equal(Array.from(core.ObjectsManager.objectsOfType(FireBall)).length, 1);
        const brute = core.ObjectsFactory.instantiateWithPosition("Michau", [750, 640]) as Enemy;
        brute.configureAdventure("brute");
        assert.equal(brute.MaxHP, 550);
        core.Runtime.timeMs = 3200;
        brute.update(0);
        const ring = Array.from(core.ObjectsManager.objectsOfType(FireBall)).filter(
            (entry) => entry.Owner === brute.ID,
        );
        assert.equal(ring.length, 8);
        assert.ok(ring.every((entry) => entry.Power === 12 && entry.Velocity === 0.24));
        brute.update(0);
        assert.equal(Array.from(core.ObjectsManager.objectsOfType(FireBall)).length, 9);
        brute.hit(1000);
        core.Runtime.timeMs = 10_000;
        brute.update(0);
        assert.equal(Array.from(core.ObjectsManager.objectsOfType(FireBall)).length, 9);
    } finally {
        core.dispose();
    }
});

test("village combat: cover blocks bites and shots, while navigation finds a route around a cottage", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [280, 360]) as Player;
        const runner = core.ObjectsFactory.instantiateWithPosition("Michau", [254, 360]) as Enemy;
        runner.configureAdventure("runner");
        core.Runtime.timeMs = 5000;
        runner.update(0);
        assert.equal(player.HP, 200, "a target inside the cottage footprint cannot be hit through its wall");
        const from = [240, 360] as const;
        const to = [464, 360] as const;
        assert.equal(villageLineClear(from, to), false);
        const next = villageWaypoint(from, to);
        assert.ok(next, "a route must exist around the house");
        assert.ok(isVillageWalkable(...next));
        assert.ok(villageLineClear(from, next));
        assert.notDeepEqual(next, to);
        assert.ok(
            villageWaypoint(from, [440, 360]),
            "a walkable target touching cover need not occupy a walkable cell centre",
        );
        assert.equal(villageLineClear([1060, 400], [1180, 400]), false, "water is cover too");
        assert.equal(villageLineClear([1040, 640], [1200, 640]), true, "the bridge remains traversable");
    } finally {
        core.dispose();
    }
});

test("village combat: the legacy enemy and performance worlds retain their own behavior", () => {
    for (const options of [{ role: Origin.CLIENT }, { role: Origin.SERVER, performanceMode: true }]) {
        const core = new GameCore(options);
        try {
            const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [640, 640]) as Enemy;
            assert.throws(() => enemy.configureAdventure("runner"), /ordinary server/);
            assert.equal(enemy.MaxHP, 100);
        } finally {
            core.dispose();
        }
    }
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [640, 640]) as Enemy;
        assert.throws(() => enemy.configureAdventure("forged" as "runner"), RangeError);
        assert.equal(enemy.MaxHP, 100);
    } finally {
        core.dispose();
    }
});
