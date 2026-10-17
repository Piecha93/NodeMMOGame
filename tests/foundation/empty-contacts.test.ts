import assert from "node:assert/strict";
import test from "node:test";
import { Body } from "detect-collisions";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Obstacle } from "../../shared/game_utils/game/objects/Obstacle";
import { CollisionsSystem } from "../../shared/game_utils/physics/CollisionsSystem";
import { Transform } from "../../shared/game_utils/physics/Transform";

interface ContactState {
    collidingBodiesMap: Map<Body, Set<Body>>;
    incomingCollidingBodiesMap: Map<Body, Set<Body>>;
    solidCandidates: Set<GameObject>;
}

function insert(system: CollisionsSystem, object: GameObject): void {
    object.addDestroyListener(() => system.removeObject(object));
    system.insertObject(object);
}

test("empty contacts: repeated empty-solid queries retain the existing contact set and publish geometry", (t) => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    const other = new Enemy(new Transform([5, 0], 10));
    for (const object of [actor, other]) insert(system, object);
    const state = system as unknown as ContactState;
    const body = actor.Colliders[0].Body;
    const initial = state.collidingBodiesMap.get(body);
    const queries = t.mock.method(body, "potentials");
    try {
        for (let step = 1; step <= 4; step++) {
            actor.Transform.X = step;
            actor.updateColliders();
            system.updateGeometry();
            system.updateCollisionsForGameObject(actor);
            assert.equal(state.solidCandidates.size, 0);
            assert.equal(state.collidingBodiesMap.get(body), initial);
            assert.equal(initial?.size, 0);
            assert.equal(body.x, step);
            assert.equal(state.incomingCollidingBodiesMap.size, 0);
        }
        assert.equal(queries.mock.callCount(), 0);
    } finally {
        actor.destroy();
        other.destroy();
    }
});

test("empty contacts: newly added solid geometry leaves the shortcut and delivers contact callbacks", (t) => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    insert(system, actor);
    const state = system as unknown as ContactState;
    const collider = actor.Colliders[0];
    const initial = state.collidingBodiesMap.get(collider.Body);
    system.update();
    system.updateCollisionsForGameObject(actor);
    assert.equal(state.collidingBodiesMap.get(collider.Body), initial);
    const wall = new Obstacle(new Transform([100, 0], 10));
    insert(system, wall);
    const enter = t.mock.method(collider, "onCollisionEnter");
    const stay = t.mock.method(collider, "onCollisionStay");
    try {
        wall.Transform.X = 5;
        wall.updateColliders();
        system.update();
        system.updateCollisionsForGameObject(actor);
        assert.equal(enter.mock.callCount(), 1);
        assert.equal(stay.mock.callCount(), 1);
        assert.equal(actor.Transform.X, -5);
        assert.equal(state.collidingBodiesMap.get(collider.Body)?.has(wall.Colliders[0].Body), true);
        assert.equal(state.incomingCollidingBodiesMap.get(wall.Colliders[0].Body)?.has(collider.Body), true);
    } finally {
        actor.destroy();
        wall.destroy();
    }
});

test("empty contacts: a retained old contact still exits after the last solid candidate disappears", () => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    const target = new Enemy(new Transform([5, 0], 10));
    for (const object of [actor, target]) insert(system, object);
    const state = system as unknown as ContactState;
    const collider = actor.Colliders[0];
    const targetBody = target.Colliders[0].Body;
    try {
        const solidity = target as unknown as { isSolid: boolean };
        solidity.isSolid = true;
        system.update();
        system.updateCollisionsForGameObject(actor);
        assert.equal(state.collidingBodiesMap.get(collider.Body)?.has(targetBody), true);
        solidity.isSolid = false;
        target.Transform.X = 100;
        target.updateColliders();
        actor.updateColliders();
        system.update();
        assert.equal(state.solidCandidates.size, 0);
        let exits = 0;
        actor.canSkipNonSolidContacts = () => true;
        collider.onCollisionExit = () => exits++;
        system.updateCollisionsForGameObject(actor);
        assert.equal(exits, 1);
        assert.equal(state.collidingBodiesMap.get(collider.Body)?.size, 0);
        assert.equal(state.incomingCollidingBodiesMap.has(targetBody), false);
        system.updateCollisionsForGameObject(actor);
        assert.equal(exits, 1, "an empty history cannot repeat an exit");
    } finally {
        actor.destroy();
        target.destroy();
    }
});

test("empty contacts: custom contact-policy getters are evaluated before preserving an empty history", () => {
    const system = new CollisionsSystem();
    const actor = new Enemy(new Transform([0, 0], 10));
    insert(system, actor);
    const state = system as unknown as ContactState;
    const body = actor.Colliders[0].Body;
    const initial = state.collidingBodiesMap.get(body);
    let policyReads = 0;
    Object.defineProperty(actor, "contactFilter", {
        configurable: true,
        get: () => {
            policyReads++;
            return () => null;
        },
    });
    try {
        system.update();
        for (let step = 0; step < 3; step++) system.updateCollisionsForGameObject(actor);
        assert.equal(policyReads, 3);
        assert.equal(state.collidingBodiesMap.get(body), initial);
    } finally {
        actor.destroy();
    }
});
