import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { GameObjectsManager } from "../../shared/game_utils/factory/GameObjectsManager";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Transform } from "../../shared/game_utils/physics/Transform";

test("world type index: includes existing and future subclasses in stable registration order", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const first = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [200, 100]);
        const players = core.ObjectsManager.objectsOfType(Player);
        const actors = core.ObjectsManager.objectsOfType(Actor);
        assert.deepEqual([...players], [first]);
        assert.deepEqual([...actors], [first, enemy]);
        const second = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [300, 100]);
        core.ObjectsFactory.instantiateWithPosition("Wall", [400, 100]);
        assert.deepEqual([...players], [first, second]);
        assert.deepEqual([...actors], [first, enemy, second]);
        enemy.destroy();
        first.destroy();
        assert.deepEqual([...players], [second]);
        assert.deepEqual([...actors], [second]);
        core.dispose();
        assert.deepEqual([...players], []);
        assert.deepEqual([...actors], []);
    } finally {
        core.dispose();
    }
});

test("world type index: rollback removes failed registrations even when creation callbacks observe the live index", () => {
    const manager = new GameObjectsManager(() => {});
    const objects = manager.objectsOfType(GameObject);
    const object = new Enemy(new Transform([100, 100]));
    object.ID = "B1";
    let seenDuringCreate = false;
    manager.subscribe({
        created: (created) => {
            seenDuringCreate = [...objects].includes(created);
            throw new Error("Creation failed");
        },
    });
    assert.throws(() => manager.register(object), AggregateError);
    assert.equal(seenDuringCreate, true);
    assert.equal(object.IsDestroyed, true);
    assert.deepEqual([...objects], []);
    assert.equal(manager.ObjectsById.size, 0);
    manager.dispose();
});

test("enemy targeting: equal-distance player selection keeps registration order across indexed lifecycle changes", () => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    try {
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", [700, 700]) as Enemy;
        enemy.Weapon = null;
        const left = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [400, 700]) as Player;
        const right = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1000, 700]) as Player;
        enemy.update(100);
        assert.equal(enemy.Transform.X, 689);
        enemy.Transform.X = 700;
        left.destroy();
        enemy.update(100);
        assert.equal(enemy.Transform.X, 711);
        enemy.Transform.X = 700;
        right.hit(right.MaxHP);
        enemy.update(100);
        assert.equal(enemy.Transform.X, 700);
        assert.equal(enemy.Vertical, 0);
        const newcomer = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [700, 400]);
        enemy.update(100);
        assert.equal(enemy.Transform.Y, 689);
        assert.deepEqual([...core.ObjectsManager.objectsOfType(Player)], [right, newcomer]);
    } finally {
        core.dispose();
    }
});
