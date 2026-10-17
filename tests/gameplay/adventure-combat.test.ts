import assert from "node:assert/strict";
import test, { TestContext } from "node:test";
import { Result } from "detect-collisions";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { createAdventureBuild, WeaponId } from "../../shared/gameplay/Adventure";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Collision } from "../../shared/game_utils/physics/Collision";
import { MouseKeys } from "../../shared/input/InputCommands";
import { captureEntity } from "../../shared/replication/EntityAdapter";
import { encodeSnapshotV3, decodeSnapshotV3 } from "../../shared/protocol";

const ranks = { power: 0, haste: 0, vitality: 0, stride: 0 } as const;

function fixture(t: TestContext, weapon: WeaponId = "ember") {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    t.after(() => core.dispose());
    const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [500, 500]) as Player;
    player.applyAdventureBuild(createAdventureBuild(weapon, ranks));
    return { core, player };
}

function shots(core: GameCore): FireBall[] {
    return Array.from(core.ObjectsManager.ObjectsById.values()).filter(
        (object): object is FireBall => object instanceof FireBall,
    );
}

function contact(source: GameObject, target: GameObject): void {
    source.onCollisionEnter(new Collision(source.Colliders[0], target.Colliders[0], new Result()));
}

test("adventure combat: three weapons have different authoritative patterns, damage, speed and range", (t) => {
    const { core, player } = fixture(t);
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    const ember = shots(core)[0];
    assert.equal(ember.Power, 25);
    assert.equal(ember.Transform.Rotation, 0);
    assert.ok(ember.Transform.X > player.Transform.X);
    core.Runtime.timeMs = 1000;
    player.applyAdventureBuild(createAdventureBuild("scatter", ranks));
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    const spread = shots(core).slice(1);
    assert.equal(spread.length, 3);
    assert.deepEqual(
        spread.map((shot) => shot.Transform.Rotation),
        [-0.19, 0, 0.19],
    );
    assert.ok(spread.every((shot) => shot.Power === 22 && shot.SpriteName === "fireball"));
    core.Runtime.timeMs = 2000;
    player.applyAdventureBuild(createAdventureBuild("lance", ranks));
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    const lance = shots(core).at(-1)!;
    assert.equal(lance.Power, 60);
    assert.equal(lance.SpriteName, "bluebolt");
    const before = lance.Transform.X;
    lance.update(100);
    assert.equal(lance.Transform.X - before, 160);
    for (const shot of spread) shot.update(600);
    assert.ok(
        spread.every((shot) => shot.IsDestroyed),
        "scatter has a bounded short effective range",
    );
});

test("adventure combat: swapping weapons or applying a build cannot reset the existing cooldown", (t) => {
    const { core, player } = fixture(t);
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    player.applyAdventureBuild(createAdventureBuild("lance", ranks));
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    assert.equal(shots(core).length, 1);
    core.Runtime.timeMs = 180;
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    assert.equal(shots(core).length, 2);
    player.applyAdventureBuild(createAdventureBuild("scatter", ranks));
    core.Runtime.timeMs = 829;
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    assert.equal(shots(core).length, 2);
    core.Runtime.timeMs = 830;
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    assert.equal(shots(core).length, 5);
});

test("adventure combat: power upgrades keep damage and resulting HP valid on the integer wire schema", (t) => {
    const { core, player } = fixture(t);
    player.applyAdventureBuild(createAdventureBuild("ember", { ...ranks, power: 1 }));
    const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [900, 500]) as Enemy;
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    const shot = shots(core)[0];
    assert.equal(shot.Power, 30);
    contact(shot, enemy);
    assert.equal(enemy.HP, 70);
    const state = captureEntity(enemy);
    const frames = encodeSnapshotV3({
        serverTick: 0,
        snapshotId: 0,
        lastProcessedInputSeq: null,
        records: [{ kind: "create", state }],
    });
    assert.equal(decodeSnapshotV3(frames).records.length, 1);
    assert.throws(() => shot.configureCombat(29.5, 1, 1000), RangeError);
});

test("adventure combat: a lance hits three distinct enemies once each, while cooperative allies are ignored", (t) => {
    const { core, player } = fixture(t, "lance");
    const ally = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [600, 500]) as Player;
    const enemies = [700, 800, 900, 1000].map(
        (x) => core.ObjectsFactory.instantiateWithPosition("Michau", [x, 500]) as Enemy,
    );
    player.Weapon?.use(player, [1200, 500], MouseKeys.LEFT);
    const shot = shots(core)[0];
    contact(shot, ally);
    assert.equal(ally.HP, 200);
    assert.equal(shot.IsDestroyed, false);
    contact(shot, enemies[0]);
    contact(shot, enemies[0]);
    assert.equal(enemies[0].HP, 40);
    assert.equal(shot.IsDestroyed, false);
    contact(shot, enemies[1]);
    assert.equal(shot.IsDestroyed, false);
    contact(shot, enemies[2]);
    assert.equal(shot.IsDestroyed, true);
    contact(shot, enemies[3]);
    assert.deepEqual(
        enemies.map((enemy) => enemy.HP),
        [40, 40, 40, 100],
    );
});

test("adventure combat: right-click burst has its own three-second simulation cooldown and works at the body centre", (t) => {
    const { core, player } = fixture(t);
    player.Weapon?.use(player, player.Transform.Position, MouseKeys.RIGHT);
    assert.equal(shots(core).length, 12);
    assert.equal(new Set(shots(core).map((shot) => shot.Transform.Rotation)).size, 12);
    player.Weapon?.use(player, player.Transform.Position, MouseKeys.RIGHT);
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    assert.equal(shots(core).length, 13, "burst does not consume the ordinary firing cooldown");
    player.applyAdventureBuild(createAdventureBuild("lance", ranks));
    core.Runtime.timeMs = 2999;
    player.Weapon?.use(player, player.Transform.Position, MouseKeys.RIGHT);
    assert.equal(shots(core).length, 13);
    core.Runtime.timeMs = 3000;
    player.Weapon?.use(player, player.Transform.Position, MouseKeys.RIGHT);
    assert.equal(shots(core).length, 25);
});

test("adventure combat: vitality preserves wounds, same-build and weapon changes never heal, and death remains authoritative", (t) => {
    const { player } = fixture(t);
    player.hit(50);
    player.applyAdventureBuild(createAdventureBuild("ember", { ...ranks, vitality: 1 }));
    assert.equal(player.MaxHP, 230);
    assert.equal(player.HP, 180);
    player.applyAdventureBuild(createAdventureBuild("lance", { ...ranks, vitality: 1 }));
    assert.equal(player.HP, 180);
    player.applyAdventureBuild(createAdventureBuild("ember", { ...ranks, vitality: 1 }));
    assert.equal(player.HP, 180);
    player.hit(1000);
    player.applyAdventureBuild(createAdventureBuild("ember", { ...ranks, vitality: 2 }));
    assert.equal(player.HP, 0);
    player.respawn();
    assert.equal(player.HP, 260);
});

test("adventure combat: clients and the performance world cannot acquire authoritative run builds", (t) => {
    for (const options of [{ role: Origin.CLIENT }, { role: Origin.SERVER, performanceMode: true }]) {
        const core = new GameCore(options);
        t.after(() => core.dispose());
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [500, 500]) as Player;
        assert.throws(() => player.applyAdventureBuild(createAdventureBuild("ember", ranks)), /authoritative/);
    }
    const { core, player } = fixture(t);
    player.hit(1000);
    player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
    player.Weapon?.use(player, [900, 500], MouseKeys.RIGHT);
    assert.equal(shots(core).length, 0);
});

test("adventure combat: every weapon stops on thin cover at the player's edge at the fixed simulation rate", (t) => {
    for (const weapon of ["ember", "scatter", "lance"] as const) {
        const { core, player } = fixture(t, weapon);
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [1000, 500], [1, 200]);
        assert.equal(wall.IsDestroyed, false);
        wall.Transform.X = 516.5;
        wall.updateColliders();
        core.CollisionsSystem.update();
        player.Weapon?.use(player, [900, 500], MouseKeys.LEFT);
        assert.ok(shots(core).length > 0);
        core.step();
        assert.equal(shots(core).length, 0, `${weapon} must not skip the one-pixel wall`);
    }
});
