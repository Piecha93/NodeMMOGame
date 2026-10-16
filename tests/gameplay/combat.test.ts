import assert from "node:assert/strict";
import { test } from "node:test";
import { Result } from "detect-collisions";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/SharedConfig";
import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Item } from "../../shared/game_utils/game/objects/Item";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { MagicWand } from "../../shared/game_utils/game/weapons/MagicWand";
import { Collision } from "../../shared/game_utils/physics/Collision";
import { INPUT_COMMAND, MouseKeys } from "../../shared/input/InputCommands";
import { InputSnapshot } from "../../shared/input/InputSnapshot";

function contact(source: GameObject, target: GameObject): void {
    source.onCollisionEnter(new Collision(source.Colliders[0], target.Colliders[0], new Result()));
}

function shots(core: GameCore): FireBall[] {
    return Array.from(core.ObjectsManager.ObjectsById.values()).filter(
        (object): object is FireBall => object instanceof FireBall,
    );
}

function fire(core: GameCore, owner: Actor): FireBall {
    const shot = core.ObjectsFactory.instantiateWithPosition("FireBall", [1000, 1000]) as FireBall;
    shot.setOwner(owner);
    return shot;
}

test("combat: wand uses simulation time, independent cooldowns and only the primary button", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const first = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const second = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [200, 100]) as Player;
        first.Weapon?.use(first, [300, 100], MouseKeys.RIGHT);
        first.Weapon?.use(first, [300, 100], MouseKeys.MIDDLE);
        assert.equal(shots(core).length, 0);
        first.Weapon?.use(first, [300, 100], MouseKeys.LEFT);
        first.Weapon?.use(first, [300, 100], MouseKeys.LEFT);
        second.Weapon?.use(second, [300, 100], MouseKeys.LEFT);
        assert.equal(shots(core).length, 2, "each wand owns its cooldown");
        core.Runtime.timeMs = 239;
        first.Weapon?.use(first, [300, 100], MouseKeys.LEFT);
        assert.equal(shots(core).length, 2);
        core.Runtime.timeMs = 240;
        first.Weapon?.use(first, [300, 100], MouseKeys.LEFT);
        assert.equal(shots(core).length, 3);
        first.hit(200);
        core.Runtime.timeMs = 1000;
        first.Weapon?.use(first, [300, 100], MouseKeys.LEFT);
        assert.equal(shots(core).length, 3, "dead actors cannot shoot");
        assert.throws(() => new MagicWand(0), RangeError);
    } finally {
        core.dispose();
    }
});

test("combat: the client and prediction replay never create authoritative projectiles", () => {
    const core = new GameCore({ role: Origin.CLIENT, cooperative: true });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        player.Weapon?.use(player, [300, 100], MouseKeys.LEFT);
        const input = new InputSnapshot();
        input.append(INPUT_COMMAND.LEFT_MOUSE, "300,100");
        player.setInput(input);
        assert.equal(shots(core).length, 0);
    } finally {
        core.dispose();
    }
});

test("combat: death stops movement/actions, respawn resets input/colliders and grants exactly three seconds of grace", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        player.configureRespawn([300, 400]);
        const input = new InputSnapshot();
        input.append(INPUT_COMMAND.VERTICAL, "1");
        input.append(INPUT_COMMAND.LEFT_MOUSE, "500,400");
        player.hit(player.MaxHP);
        assert.equal(player.RespawnInMs, 3000);
        player.setInput(input);
        player.updatePosition(1000);
        player.update(1000);
        assert.deepEqual(player.Transform.Position, [100, 100]);
        assert.equal(shots(core).length, 0);
        assert.equal(player.Vertical, 0);
        player.heal(100);
        assert.equal(player.HP, 0, "a potion cannot bypass the respawn countdown");
        core.Runtime.timeMs = 2999;
        player.update(1);
        assert.equal(player.HP, 0);
        core.Runtime.timeMs = 3000;
        player.update(1);
        assert.equal(player.HP, 200);
        assert.equal(player.RespawnInMs, 0);
        assert.deepEqual(player.Transform.Position, [300, 400]);
        assert.equal(player.Horizontal, 0);
        assert.equal(player.Vertical, 0);
        for (const collider of player.Colliders) {
            assert.equal(collider.Body.x, 300);
            assert.equal(collider.Body.y, 400);
        }
        player.hit(25);
        core.Runtime.timeMs = 5999;
        player.hit(25);
        assert.equal(player.HP, 200);
        core.Runtime.timeMs = 6000;
        player.hit(25);
        assert.equal(player.HP, 175);
        player.respawn([700, 800]);
        assert.equal(player.HP, 200);
        assert.deepEqual(player.Transform.Position, [700, 800]);
    } finally {
        core.dispose();
    }
});

test("combat: sandbox death does not silently add a cooperative respawn loop", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        player.hit(player.MaxHP);
        core.Runtime.timeMs = 10_000;
        player.update(1);
        assert.equal(player.HP, 0);
        assert.equal(player.RespawnInMs, 0);
    } finally {
        core.dispose();
    }
});

test("combat: cooperative projectiles skip team mates and still damage opponents", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const ally = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [200, 100]) as Player;
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [400, 100]) as Enemy;
        const secondEnemy = core.ObjectsFactory.instantiateWithPosition("Michau", [500, 100]) as Enemy;
        assert.equal(enemy.MaxHP, 100);
        const playerShot = fire(core, player);
        contact(playerShot, player);
        contact(playerShot, ally);
        assert.equal(ally.HP, ally.MaxHP);
        assert.equal(playerShot.IsDestroyed, false);
        contact(playerShot, enemy);
        assert.equal(enemy.HP, 75);
        assert.equal(playerShot.IsDestroyed, true);
        const enemyShot = fire(core, enemy);
        contact(enemyShot, secondEnemy);
        assert.equal(secondEnemy.HP, secondEnemy.MaxHP);
        assert.equal(enemyShot.IsDestroyed, false);
        enemy.destroy();
        contact(enemyShot, secondEnemy);
        assert.equal(secondEnemy.HP, secondEnemy.MaxHP, "the projectile keeps its team after its owner dies");
        contact(enemyShot, ally);
        assert.equal(ally.HP, 175);
        assert.equal(enemyShot.IsDestroyed, true);
    } finally {
        core.dispose();
    }
});

test("combat: sandbox retains friendly fire and a player proximity trigger no longer deletes enemies", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const ally = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [200, 100]) as Player;
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [400, 100]) as Enemy;
        const shot = fire(core, player);
        contact(shot, ally);
        assert.equal(ally.HP, 175);
        player.onTriggerEnter(new Collision(player.Colliders[1], enemy.Colliders[0], new Result()));
        assert.equal(enemy.IsDestroyed, false);
    } finally {
        core.dispose();
    }
});

test("combat: real simulation collisions let a cooperative projectile pass allies and damage an enemy", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true, fixedDeltaMs: 20 });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const ally = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [250, 100]) as Player;
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [400, 100]) as Enemy;
        enemy.Weapon = null;
        enemy.Velocity = 0;
        player.Weapon?.use(player, [500, 100], MouseKeys.LEFT);
        const shot = shots(core)[0];
        assert.ok(shot);
        for (let tick = 0; tick < 20 && !shot.IsDestroyed; tick++) core.step();
        assert.equal(ally.HP, 200);
        assert.equal(enemy.HP, 75);
        assert.equal(shot.IsDestroyed, true);
    } finally {
        core.dispose();
    }
});

test("combat: enemies choose the nearest living player, stop at shooting range and use a slower attack cooldown", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [700, 700]) as Enemy;
        const dead = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [710, 700]) as Player;
        dead.hit(dead.MaxHP);
        const far = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [350, 700]) as Player;
        const near = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [950, 700]) as Player;
        enemy.update(100);
        assert.equal(enemy.Transform.X, 711, "the nearest living target is to the right");
        assert.equal(enemy.Transform.Y, 700);
        assert.equal(shots(core).length, 1);
        enemy.Transform.X = 800;
        core.Runtime.timeMs = 1199;
        enemy.update(100);
        assert.equal(enemy.Transform.X, 800, "stop instead of walking into a ranged target");
        assert.equal(shots(core).length, 1);
        core.Runtime.timeMs = 1200;
        enemy.update(100);
        assert.equal(shots(core).length, 2);
        assert.ok(Math.cos(shots(core)[1].Transform.Rotation) > 0.999, "the shot aims at the living player");
        near.destroy();
        far.destroy();
        enemy.update(100);
        assert.equal(enemy.Transform.X, 800);
        assert.equal(enemy.Horizontal, 0);
        assert.equal(enemy.Vertical, 0);
    } finally {
        core.dispose();
    }
});

test("combat: enemies leash home instead of following players across the entire world", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [700, 700]) as Enemy;
        enemy.setHomePosition([700, 700]);
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1500, 700]);
        enemy.Transform.X = 1350;
        enemy.update(100);
        assert.equal(enemy.Transform.X, 1339);
        assert.equal(shots(core).length, 0);
        enemy.Transform.X = 1200;
        enemy.update(100);
        assert.equal(enemy.Transform.X, 1189, "returning home continues inside the leash radius");
        enemy.Transform.X = 705;
        enemy.update(100);
        assert.equal(enemy.Transform.X, 705);
        enemy.hit(100);
        enemy.update(1);
        assert.equal(enemy.IsDestroyed, true);
    } finally {
        core.dispose();
    }
});

test("combat: health potions survive scenery, projectiles, enemies, full-health and dead players", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const potion = core.ObjectsFactory.instantiateWithPosition("HpPotion", [100, 100]) as Item;
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [300, 100]);
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [500, 100]) as Enemy;
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [700, 100]) as Player;
        contact(potion, wall);
        contact(potion, enemy);
        contact(potion, fire(core, enemy));
        contact(potion, player);
        assert.equal(potion.IsDestroyed, false);
        assert.equal(potion.Consumed, false);
        player.hit(200);
        contact(potion, player);
        assert.equal(potion.IsDestroyed, false);
        core.Runtime.timeMs = 10_000;
        player.respawn();
        core.Runtime.timeMs += 3000;
        player.hit(25);
        contact(potion, player);
        assert.equal(player.HP, 200, "healing clamps to the maximum health");
        assert.equal(potion.IsDestroyed, true);
        assert.equal(potion.Consumed, true);
    } finally {
        core.dispose();
    }
});
