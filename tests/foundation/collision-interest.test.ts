import assert from "node:assert/strict";
import test from "node:test";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Collision } from "../../shared/game_utils/physics/Collision";
import { CollisionsSystem } from "../../shared/game_utils/physics/CollisionsSystem";
import { Transform } from "../../shared/game_utils/physics/Transform";
import { mayBecomeSolid } from "../../shared/game_utils/game/CollisionPolicy";
import { Doors } from "../../shared/game_utils/game/objects/Doors";
import { Actor } from "../../shared/game_utils/game/objects/Actor";

class ContactObserver extends GameObject {
    enters = 0;
    stays = 0;
    exits = 0;
    solid = false;
    protected override sharedOnCollisionEnter(): void {
        this.enters++;
    }
    protected override sharedOnCollisionStay(): void {
        this.stays++;
    }
    protected override sharedOnCollisionExit(): void {
        this.exits++;
    }
    override get IsSolid(): boolean {
        return this.solid;
    }
}

function insert(system: CollisionsSystem, object: GameObject): void {
    object.addDestroyListener(() => system.removeObject(object));
    system.insertObject(object);
}

test("collision interest: empty actor contacts skip narrowphase while the other endpoint still observes them", () => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    const target = new ContactObserver(new Transform([5, 0], 10));
    let narrowphaseCalls = 0;
    const collider = actor.Colliders[0]!;
    const collides = collider.collides.bind(collider);
    collider.collides = (...args) => {
        narrowphaseCalls++;
        return collides(...args);
    };
    insert(system, actor);
    insert(system, target);
    system.update();
    system.updateCollisions([actor, target]);
    assert.equal(narrowphaseCalls, 0);
    assert.equal(target.enters, 1);
    assert.equal(target.stays, 1);
    assert.equal(actor.Transform.X, 0);
    target.solid = true;
    system.updateCollisionsForGameObject(actor);
    assert.equal(narrowphaseCalls, 1);
    assert.equal(actor.Transform.X, -5, "solid geometry still resolves the actor overlap");
    actor.destroy();
    target.destroy();
});

test("collision interest: changing solidity releases retained actor contacts", () => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    const target = new ContactObserver(new Transform([5, 0], 10));
    insert(system, actor);
    insert(system, target);
    target.solid = true;
    system.update();
    system.updateCollisionsForGameObject(actor);
    const contacts = (system as unknown as { collidingBodiesMap: Map<unknown, Set<unknown>> }).collidingBodiesMap;
    assert.equal(contacts.get(actor.Colliders[0]!.Body)?.has(target.Colliders[0]!.Body), true);
    target.solid = false;
    system.updateCollisionsForGameObject(actor);
    assert.equal(contacts.get(actor.Colliders[0]!.Body)?.size, 0);
    actor.destroy();
    target.destroy();
});

test("collision interest: custom actor hooks keep enter, stay and exit for nonsolid targets", () => {
    class CustomEnemy extends Enemy {
        events: string[] = [];
        protected override serverOnCollisionEnter(): void {
            this.events.push("enter");
        }
        protected override sharedOnCollisionStay(collision: Collision): void {
            super.sharedOnCollisionStay(collision);
            this.events.push("stay");
        }
        protected override sharedOnCollisionExit(): void {
            this.events.push("exit");
        }
    }
    const system = new CollisionsSystem();
    const actor = new CustomEnemy(new Transform([0, 0], 10));
    const target = new GameObject(new Transform([5, 0], 10));
    insert(system, actor);
    insert(system, target);
    system.update();
    system.updateCollisionsForGameObject(actor);
    target.Transform.X = 100;
    target.updateColliders();
    system.update();
    system.updateCollisionsForGameObject(actor);
    assert.deepEqual(actor.events, ["enter", "stay", "exit"]);
    actor.destroy();
    target.destroy();
});

test("collision interest: runtime object and collider callbacks disable the stock actor filter", () => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    const target = new GameObject(new Transform([5, 0], 10));
    insert(system, actor);
    insert(system, target);
    system.update();
    system.updateCollisionsForGameObject(actor);
    let stays = 0;
    actor.onCollisionStay = () => stays++;
    system.updateCollisionsForGameObject(actor);
    assert.equal(stays, 1);
    let colliderStays = 0;
    actor.Colliders[0]!.onCollisionStay = () => colliderStays++;
    system.updateCollisionsForGameObject(actor);
    assert.equal(colliderStays, 1);
    actor.destroy();
    target.destroy();
});

test("collision interest: actor trigger callbacks observe nonsolid contacts", () => {
    const system = new CollisionsSystem();
    const actor = new Player(new Transform([0, 0], 10));
    const target = new GameObject(new Transform([5, 0], 10));
    let triggers = 0;
    actor.onTriggerEnter = () => triggers++;
    actor.onTriggerStay = () => triggers++;
    insert(system, actor);
    insert(system, target);
    system.update();
    system.updateCollisionsForGameObject(actor);
    assert.equal(triggers, 2);
    actor.destroy();
    target.destroy();
});

test("collision interest: no solid candidates skips BVH traversal; closed and open doors retain general traversal", () => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    const player = new Player(new Transform([5, 0], 10));
    const body = actor.Colliders[0]!.Body;
    let queries = 0;
    const potentials = body.potentials.bind(body);
    body.potentials = () => {
        queries++;
        return potentials();
    };
    insert(system, actor);
    insert(system, player);
    system.update();
    system.updateCollisionsForGameObject(actor);
    assert.equal(queries, 0);
    const door = new Doors(new Transform([100, 0], 10));
    insert(system, door);
    system.updateCollisionsForGameObject(actor);
    assert.equal(queries, 1);
    door.open();
    system.update();
    system.updateCollisionsForGameObject(actor);
    assert.equal(queries, 2, "an open door can close during callbacks and remains a candidate");
    door.destroy();
    system.updateCollisionsForGameObject(actor);
    assert.equal(queries, 2);
    actor.destroy();
    player.destroy();
});

test("collision capabilities: subclasses and runtime callbacks retain the conservative solid index", () => {
    const actor = new Enemy(new Transform([0, 0], 10));
    assert.equal(mayBecomeSolid(actor), false);
    actor.onTriggerStay = () => {};
    assert.equal(mayBecomeSolid(actor), true);
    class CustomEnemy extends Enemy {}
    assert.equal(mayBecomeSolid(new CustomEnemy(new Transform([0, 0], 10))), true);
    assert.equal(mayBecomeSolid(new GameObject(new Transform([0, 0], 10))), true);
});

test("collision capabilities: solidity getters anywhere on the runtime prototype chain retain the general index", () => {
    const actor = new Enemy(new Transform([0, 0], 10));
    for (const prototype of [actor, Enemy.prototype, Actor.prototype]) {
        const before = Object.getOwnPropertyDescriptor(prototype, "IsSolid");
        try {
            Object.defineProperty(prototype, "IsSolid", { configurable: true, get: () => false });
            assert.equal(mayBecomeSolid(actor), true);
        } finally {
            if (before) Object.defineProperty(prototype, "IsSolid", before);
            else Reflect.deleteProperty(prototype, "IsSolid");
        }
        assert.equal(mayBecomeSolid(actor), false);
    }
});
