import assert from "node:assert/strict";
import test from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Transform } from "../../shared/game_utils/physics/Transform";

for (const cooperative of [false, true]) {
    test(`projectile interest: preserves owner/team/friendly fire rules with cooperative=${cooperative}`, () => {
        const core = new GameCore({ role: Origin.SERVER, cooperative });
        try {
            const owner = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
            const ally = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [200, 100]) as Player;
            const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [300, 100]) as Enemy;
            const shot = core.ObjectsFactory.instantiateWithPosition("FireBall", [100, 100]) as FireBall;
            const sameOwnerShot = core.ObjectsFactory.instantiateWithPosition("FireBall", [110, 100]) as FireBall;
            const allyShot = core.ObjectsFactory.instantiateWithPosition("FireBall", [120, 100]) as FireBall;
            const enemyShot = core.ObjectsFactory.instantiateWithPosition("FireBall", [130, 100]) as FireBall;
            shot.setOwner(owner);
            sameOwnerShot.setOwner(owner);
            allyShot.setOwner(ally);
            enemyShot.setOwner(enemy);
            const filter = shot.contactFilter(shot.Colliders[0]!);
            assert.ok(filter);
            assert.equal(filter(owner.Colliders[0]!), false);
            assert.equal(filter(ally.Colliders[0]!), !cooperative);
            assert.equal(filter(enemy.Colliders[0]!), true);
            assert.equal(filter(sameOwnerShot.Colliders[0]!), false);
            assert.equal(filter(allyShot.Colliders[0]!), !cooperative);
            assert.equal(filter(enemyShot.Colliders[0]!), true);
            shot.Owner = "A999999";
            assert.equal(
                filter(ally.Colliders[0]!),
                true,
                "unknown owners and teams retain the general collision path",
            );
        } finally {
            core.dispose();
        }
    });
}

test("projectile interest: cooperative allies skip narrowphase while opponents still take damage", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const owner = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const ally = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [104, 100]) as Player;
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [300, 100]) as Enemy;
        const shot = core.ObjectsFactory.instantiateWithPosition("FireBall", [100, 100]) as FireBall;
        shot.setOwner(owner);
        const collider = shot.Colliders[0]!;
        const collides = collider.collides.bind(collider);
        let calls = 0;
        collider.collides = (...args) => {
            calls++;
            return collides(...args);
        };
        core.CollisionsSystem.update();
        core.CollisionsSystem.updateCollisionsForGameObject(shot);
        assert.equal(calls, 0);
        assert.equal(shot.IsDestroyed, false);
        assert.equal(ally.HP, ally.MaxHP);
        enemy.Transform.X = 104;
        enemy.updateColliders();
        core.CollisionsSystem.update();
        core.CollisionsSystem.updateCollisionsForGameObject(shot);
        assert.equal(enemy.HP, enemy.MaxHP - shot.Power);
        assert.equal(shot.IsDestroyed, true);
    } finally {
        core.dispose();
    }
});

test("projectile interest: custom subclasses and runtime object/collider hooks keep every contact", () => {
    class CustomProjectile extends FireBall {}
    const custom = new CustomProjectile(new Transform([0, 0], 8));
    assert.equal(custom.contactFilter(custom.Colliders[0]!), null);
    const shot = new FireBall(new Transform([0, 0], 8));
    shot.setOwner(new Enemy(new Transform([0, 0], 16)));
    assert.ok(shot.contactFilter(shot.Colliders[0]!));
    shot.onCollisionStay = () => {};
    assert.equal(shot.contactFilter(shot.Colliders[0]!), null);
    Reflect.deleteProperty(shot, "onCollisionStay");
    assert.ok(shot.contactFilter(shot.Colliders[0]!));
    shot.Colliders[0]!.onCollisionEnter = () => {};
    assert.equal(shot.contactFilter(shot.Colliders[0]!), null);
});

test("projectile interest: inherited prototype callback changes disable the filter", () => {
    const shot = new FireBall(new Transform([0, 0], 8));
    shot.setOwner(new Enemy(new Transform([0, 0], 16)));
    const prototype = GameObject.prototype as unknown as Record<string, unknown>;
    const original = prototype.serverOnCollisionEnter;
    try {
        prototype.serverOnCollisionEnter = () => {};
        assert.equal(shot.contactFilter(shot.Colliders[0]!), null);
    } finally {
        prototype.serverOnCollisionEnter = original;
    }
    assert.ok(shot.contactFilter(shot.Colliders[0]!));
});

test("projectile interest: a legacy owner reference retains contact history when its owner disappears", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const owner = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const target = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [110, 100]) as Player;
        const shot = core.ObjectsFactory.instantiateWithPosition("FireBall", [110, 100]) as FireBall;
        shot.Owner = owner.ID;
        assert.equal(shot.contactFilter(shot.Colliders[0]!), null);
        core.CollisionsSystem.update();
        core.CollisionsSystem.updateCollisionsForGameObject(shot);
        owner.destroy();
        core.CollisionsSystem.updateCollisionsForGameObject(shot);
        assert.equal(target.HP, target.MaxHP);
        assert.equal(
            shot.IsDestroyed,
            false,
            "a continuous contact is a stay, not a new hit after the owner disappears",
        );
    } finally {
        core.dispose();
    }
});

test("projectile interest: a dynamic target team retains enter/stay history across a team change", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const owner = core.ObjectsFactory.instantiateWithPosition("Michau", [100, 100]) as Enemy;
        const target = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [110, 100]) as Player;
        const shot = core.ObjectsFactory.instantiateWithPosition("FireBall", [110, 100]) as FireBall;
        shot.setOwner(owner);
        let team = "enemies";
        Object.defineProperty(target, "CombatTeam", { configurable: true, get: () => team });
        const filter = shot.contactFilter(shot.Colliders[0]!);
        assert.ok(filter);
        assert.equal(filter(target.Colliders[0]!), true, "dynamic targets retain ordinary collision tracking");
        core.CollisionsSystem.update();
        core.CollisionsSystem.updateCollisionsForGameObject(shot);
        team = "players";
        core.CollisionsSystem.updateCollisionsForGameObject(shot);
        assert.equal(target.HP, target.MaxHP);
        assert.equal(shot.IsDestroyed, false);
    } finally {
        core.dispose();
    }
});
