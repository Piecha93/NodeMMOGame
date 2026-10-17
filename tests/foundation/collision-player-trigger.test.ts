import assert from "node:assert/strict";
import test from "node:test";
import { Body } from "detect-collisions";
import { Origin } from "../../shared/core/Origin";
import { WorldContext } from "../../shared/core/WorldContext";
import { Doors } from "../../shared/game_utils/game/objects/Doors";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Collider } from "../../shared/game_utils/physics/Collider";
import { Collision } from "../../shared/game_utils/physics/Collision";
import { CollisionsSystem } from "../../shared/game_utils/physics/CollisionsSystem";
import { Transform } from "../../shared/game_utils/physics/Transform";

function insert(system: CollisionsSystem, object: GameObject): void {
    object.setRuntime(new WorldContext({ role: Origin.SERVER }));
    object.addDestroyListener(() => system.removeObject(object));
    system.insertObject(object);
}

function countQueries(player: Player): number[] {
    const counts = player.Colliders.map(() => 0);
    for (const [index, collider] of player.Colliders.entries()) {
        const original = collider.Body.potentials.bind(collider.Body);
        collider.Body.potentials = () => {
            counts[index]++;
            return original();
        };
    }
    return counts;
}

function contacts(system: CollisionsSystem, body: Body): Set<Body> | undefined {
    return (system as unknown as { collidingBodiesMap: Map<Body, Set<Body>> }).collidingBodiesMap.get(body);
}

function withDescriptor(target: object, key: string, descriptor: PropertyDescriptor, run: () => void): void {
    const before = Object.getOwnPropertyDescriptor(target, key);
    try {
        Object.defineProperty(target, key, { configurable: true, ...descriptor });
        run();
    } finally {
        if (before) Object.defineProperty(target, key, before);
        else Reflect.deleteProperty(target, key);
    }
}

test("player trigger capability: custom player, trigger/filter and collider methods disable the shortcut", () => {
    class CustomPlayer extends Player {}
    const player = new Player(new Transform([0, 0], [10, 10]));
    const trigger = player.Colliders[1];
    assert.equal(player.canSkipContactsWithoutSolidCandidates(player.Colliders[0]), false);
    assert.equal(player.canSkipContactsWithoutSolidCandidates(trigger), true);
    const custom = new CustomPlayer(new Transform([0, 0], [10, 10]));
    assert.equal(custom.canSkipContactsWithoutSolidCandidates(custom.Colliders[1]), false);
    for (const hook of [
        "onTriggerEnter",
        "onTriggerStay",
        "onTriggerExit",
        "serverOnTriggerEnter",
        "serverOnTriggerStay",
        "serverOnTriggerExit",
        "sharedOnTriggerEnter",
        "sharedOnTriggerStay",
        "sharedOnTriggerExit",
        "contactFilter",
        "canSkipNonSolidContacts",
    ])
        for (const target of [player, Player.prototype])
            withDescriptor(target, hook, { value: () => {}, writable: true }, () => {
                assert.equal(player.canSkipContactsWithoutSolidCandidates(trigger), false, hook);
            });
    for (const hook of ["onCollisionEnter", "onCollisionStay", "onCollisionExit"])
        for (const target of [trigger, Collider.prototype])
            withDescriptor(target, hook, { value: () => {}, writable: true }, () => {
                assert.equal(player.canSkipContactsWithoutSolidCandidates(trigger), false, `collider.${hook}`);
            });
    trigger.IsTriger = false;
    assert.equal(player.canSkipContactsWithoutSolidCandidates(trigger), false);
    trigger.IsTriger = true;
    assert.equal(player.canSkipContactsWithoutSolidCandidates(trigger), true, "restoring methods restores eligibility");
});

test("player trigger capability: inspecting custom hook accessors never invokes them", () => {
    const player = new Player(new Transform([0, 0], [10, 10]));
    const trigger = player.Colliders[1];
    let reads = 0;
    const getter = () => {
        reads++;
        throw new Error("trigger capability evaluated a custom getter");
    };
    for (const [target, property] of [
        [player, "onTriggerEnter"],
        [player, "contactFilter"],
        [Player.prototype, "sharedOnTriggerStay"],
        [trigger, "onCollisionEnter"],
        [Collider.prototype, "onCollisionExit"],
        [trigger, "isTrigger"],
    ] as const)
        withDescriptor(target, property, { get: getter }, () => {
            assert.equal(player.canSkipContactsWithoutSolidCandidates(trigger), false, property);
        });
    assert.equal(reads, 0);
    assert.equal(player.canSkipContactsWithoutSolidCandidates(trigger), true);
});

test("player trigger: a stock player avoids every broadphase query when no solid candidates exist", () => {
    const system = new CollisionsSystem();
    const player = new Player(new Transform([0, 0], [10, 10]));
    const enemy = new Enemy(new Transform([5, 0], [10, 10]));
    for (const object of [player, enemy]) insert(system, object);
    const queries = countQueries(player);
    try {
        system.update();
        system.updateCollisionsForGameObject(player);
        system.updateCollisionsForGameObject(player);
        assert.deepEqual(queries, [0, 0]);
        assert.equal(contacts(system, player.Colliders[1].Body)?.size, 0);
        assert.equal(enemy.IsDestroyed, false);
    } finally {
        player.destroy();
        enemy.destroy();
    }
});

for (const initiallyOpen of [false, true]) {
    test(`player trigger: ${initiallyOpen ? "open" : "closed"} doors keep enter/stay/exit and exact toggle behavior`, () => {
        const system = new CollisionsSystem();
        const player = new Player(new Transform([0, 0], [10, 10]));
        const door = new Doors(new Transform([100, 0], [10, 10]));
        for (const object of [player, door]) insert(system, object);
        const queries = countQueries(player);
        try {
            if (initiallyOpen) door.open();
            // Only the proximity trigger overlaps the door, so actor resolution
            // cannot move the player before the trigger callback is processed.
            door.Transform.X = 14;
            door.updateColliders();
            system.update();
            system.updateCollisionsForGameObject(player);
            assert.equal(queries[1], 1);
            assert.equal(door.IsSolid, initiallyOpen, "enter toggles either initial state exactly once");
            assert.equal(contacts(system, player.Colliders[1].Body)?.has(door.Colliders[0].Body), true);
            system.update();
            system.updateCollisionsForGameObject(player);
            assert.equal(queries[1], 2, "open doors remain candidates for ordinary trigger traversal");
            assert.equal(door.IsSolid, initiallyOpen, "stay never toggles the door");
            assert.equal(contacts(system, player.Colliders[1].Body)?.has(door.Colliders[0].Body), true);
            door.Transform.X = 100;
            door.updateColliders();
            system.update();
            system.updateCollisionsForGameObject(player);
            assert.equal(queries[1], 3);
            assert.equal(door.IsSolid, !initiallyOpen, "exit restores the door's initial state");
            assert.equal(contacts(system, player.Colliders[1].Body)?.size, 0);
        } finally {
            player.destroy();
            door.destroy();
        }
    });
}

test("player trigger: instance callbacks, collider callbacks and subclasses still observe nonsolid contacts", () => {
    class CustomPlayer extends Player {
        enters = 0;
        override serverOnTriggerEnter(collision: Collision): void {
            super.serverOnTriggerEnter(collision);
            this.enters++;
        }
    }
    for (const custom of ["instance", "collider", "subclass"] as const) {
        const system = new CollisionsSystem();
        const player =
            custom === "subclass"
                ? new CustomPlayer(new Transform([0, 0], [10, 10]))
                : new Player(new Transform([0, 0], [10, 10]));
        const enemy = new Enemy(new Transform([5, 0], [10, 10]));
        let enters = 0;
        if (custom === "instance") player.onTriggerEnter = () => enters++;
        if (custom === "collider") player.Colliders[1].onCollisionEnter = () => enters++;
        for (const object of [player, enemy]) insert(system, object);
        const queries = countQueries(player);
        try {
            system.update();
            system.updateCollisionsForGameObject(player);
            assert.equal(queries[1], 1, custom);
            assert.equal(player instanceof CustomPlayer ? player.enters : enters, 1, custom);
            assert.equal(contacts(system, player.Colliders[1].Body)?.has(enemy.Colliders[0].Body), true, custom);
        } finally {
            player.destroy();
            enemy.destroy();
        }
    }
});

test("player trigger: returning to stock callbacks releases earlier contacts while skipping the empty broadphase", () => {
    const system = new CollisionsSystem();
    const player = new Player(new Transform([0, 0], [10, 10]));
    const enemy = new Enemy(new Transform([5, 0], [10, 10]));
    const original = Object.getOwnPropertyDescriptor(player, "onTriggerEnter");
    player.onTriggerEnter = () => {};
    for (const object of [player, enemy]) insert(system, object);
    const queries = countQueries(player);
    try {
        system.update();
        system.updateCollisionsForGameObject(player);
        const triggerBody = player.Colliders[1].Body;
        const enemyBody = enemy.Colliders[0].Body;
        assert.equal(queries[1], 1);
        assert.equal(contacts(system, triggerBody)?.has(enemyBody), true);
        Reflect.deleteProperty(player, "onTriggerEnter");
        system.update();
        system.updateCollisionsForGameObject(player);
        assert.equal(queries[1], 1, "the restored stock trigger performs no additional query");
        assert.equal(contacts(system, triggerBody)?.size, 0);
        const incoming = (system as unknown as { incomingCollidingBodiesMap: Map<Body, Set<Body>> })
            .incomingCollidingBodiesMap;
        assert.equal(incoming.get(enemyBody)?.has(triggerBody) ?? false, false);
    } finally {
        if (original) Object.defineProperty(player, "onTriggerEnter", original);
        else Reflect.deleteProperty(player, "onTriggerEnter");
        player.destroy();
        enemy.destroy();
    }
});
