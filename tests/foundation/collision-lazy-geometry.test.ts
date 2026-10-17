import assert from "node:assert/strict";
import test from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { simulateMovement } from "../../shared/core/SimulateMovement";
import { WorldContext } from "../../shared/core/WorldContext";
import { Doors } from "../../shared/game_utils/game/objects/Doors";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { CollisionsSystem } from "../../shared/game_utils/physics/CollisionsSystem";
import { Transform } from "../../shared/game_utils/physics/Transform";

function insert(system: CollisionsSystem, object: GameObject): void {
    object.setRuntime(new WorldContext({ role: Origin.SERVER }));
    object.addDestroyListener(() => system.removeObject(object));
    system.insertObject(object);
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

function candidates(system: CollisionsSystem): ReadonlySet<GameObject> {
    return (system as unknown as { solidCandidates: Set<GameObject> }).solidCandidates;
}

test("geometry publication: policy reads are deferred until the next collision query and performed only once", () => {
    const system = new CollisionsSystem();
    const source = new Enemy(new Transform([0, 0], [10, 10]));
    const target = new Enemy(new Transform([100, 0], [10, 10]));
    for (const object of [source, target]) insert(system, object);
    let reads = 0;
    Object.defineProperty(target, "IsSolid", {
        configurable: true,
        get: () => {
            reads++;
            return false;
        },
    });
    try {
        system.update();
        assert.equal(reads, 1);
        reads = 0;
        system.updateGeometry();
        system.updateGeometry();
        system.updateGeometry();
        assert.equal(reads, 0, "publishing BVH geometry does not repeat capability scans");
        system.updateCollisionsForGameObject(source);
        assert.equal(reads, 1, "the next collision query refreshes policy before using it");
        system.updateCollisionsForGameObject(source);
        assert.equal(reads, 1, "further queries share the freshly evaluated policy");
        system.updateGeometry();
        assert.equal(reads, 1);
        system.updateCollisionsForGameObject(source);
        assert.equal(reads, 2, "another geometry publication invalidates policy again");
    } finally {
        source.destroy();
        target.destroy();
    }
});

test("geometry publication: a new solidity getter is observed before a stock actor can skip broadphase", () => {
    const system = new CollisionsSystem();
    const source = new Enemy(new Transform([0, 0], [10, 10]));
    const target = new Enemy(new Transform([5, 0], [10, 10]));
    for (const object of [source, target]) insert(system, object);
    try {
        system.update();
        assert.equal(candidates(system).size, 0);
        system.updateGeometry();
        Object.defineProperty(target, "IsSolid", { configurable: true, get: () => true });
        system.updateCollisionsForGameObject(source);
        assert.equal(
            source.Transform.X,
            -5,
            "fresh policy permits collision resolution against the newly solid target",
        );
        assert.equal(candidates(system).has(target), true);
    } finally {
        source.destroy();
        target.destroy();
    }
});

test("geometry publication: a policy getter moving another collider republishes BVH before the query", () => {
    const system = new CollisionsSystem();
    const source = new Enemy(new Transform([0, 0], [10, 10]));
    const target = new Enemy(new Transform([100, 0], [10, 10]));
    const driver = new Enemy(new Transform([1000, 0], [10, 10]));
    const objects = [source, target, driver];
    for (const object of objects) insert(system, object);
    try {
        system.update();
        assert.equal(source.Colliders[0].Body.potentials().includes(target.Colliders[0].Body), false);
        system.updateGeometry();
        Object.defineProperty(target, "IsSolid", { configurable: true, get: () => true });
        let reads = 0;
        Object.defineProperty(driver, "IsSolid", {
            configurable: true,
            get: () => {
                reads++;
                target.Transform.X = 5;
                target.updateColliders();
                return false;
            },
        });
        system.updateCollisionsForGameObject(source);
        assert.equal(reads, 1);
        assert.equal(source.Transform.X, -5, "geometry changed during policy evaluation is visible to narrowphase");
        assert.equal(source.Colliders[0].Body.potentials().includes(target.Colliders[0].Body), true);
    } finally {
        for (const object of objects) object.destroy();
    }
});

for (const override of ["instance", "class"] as const) {
    test(`geometry publication: ${override} callbacks added after publication refresh the conservative candidate index`, () => {
        const system = new CollisionsSystem();
        const source = new Enemy(new Transform([0, 0], [10, 10]));
        const target = new Player(new Transform([5, 0], [10, 10]));
        for (const object of [source, target]) insert(system, object);
        let queries = 0;
        const body = source.Colliders[0].Body;
        const original = body.potentials.bind(body);
        body.potentials = () => {
            queries++;
            return original();
        };
        try {
            system.update();
            assert.equal(candidates(system).size, 0);
            system.updateGeometry();
            withDescriptor(
                override === "instance" ? target : Player.prototype,
                "sharedOnCollisionExit",
                { value: () => {}, writable: true },
                () => {
                    system.updateCollisionsForGameObject(source);
                    assert.equal(queries, 1, "a custom target keeps the conservative broadphase path");
                    assert.equal(candidates(system).has(target), true);
                },
            );
            system.updateGeometry();
            system.updateCollisionsForGameObject(source);
            assert.equal(queries, 1, "restoring the stock target restores the empty-index shortcut");
            assert.equal(candidates(system).size, 0);
        } finally {
            source.destroy();
            target.destroy();
        }
    });
}

test("geometry publication: inserting and removing objects while dirty cannot hide another object's new solidity", () => {
    const system = new CollisionsSystem();
    const source = new Enemy(new Transform([0, 0], [10, 10]));
    const target = new Enemy(new Transform([5, 0], [10, 10]));
    const door = new Doors(new Transform([1000, 0], [10, 10]));
    for (const object of [source, target]) insert(system, object);
    try {
        system.update();
        system.updateGeometry();
        Object.defineProperty(target, "IsSolid", { configurable: true, get: () => true });
        insert(system, door);
        door.open();
        door.destroy();
        system.updateCollisionsForGameObject(source);
        assert.equal(source.Transform.X, -5);
        assert.deepEqual(candidates(system), new Set([target]));
        assert.equal(door.IsDestroyed, true);
    } finally {
        source.destroy();
        target.destroy();
        door.destroy();
    }
});

for (const initiallyOpen of [false, true]) {
    test(`geometry publication: dirty policy retains ${initiallyOpen ? "open" : "closed"} doors for player trigger callbacks`, () => {
        const system = new CollisionsSystem();
        const player = new Player(new Transform([0, 0], [10, 10]));
        const door = new Doors(new Transform([100, 0], [10, 10]));
        for (const object of [player, door]) insert(system, object);
        try {
            system.update();
            door.Transform.X = 14;
            door.updateColliders();
            system.updateGeometry();
            if (initiallyOpen) door.open();
            system.updateCollisionsForGameObject(player);
            assert.equal(candidates(system).has(door), true);
            assert.equal(door.IsSolid, initiallyOpen, "trigger enter toggles the current door state");
            system.updateGeometry();
            system.updateCollisionsForGameObject(player);
            assert.equal(door.IsSolid, initiallyOpen, "retained trigger stay does not toggle the door again");
        } finally {
            player.destroy();
            door.destroy();
        }
    });
}

for (const operation of ["world step", "input movement"] as const) {
    test(`geometry publication: ${operation} publishes corrected colliders without a second eager policy scan`, () => {
        const core = new GameCore({ role: Origin.SERVER });
        try {
            const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [100, 100]);
            const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [200, 100]) as Player;
            const distant = core.ObjectsFactory.instantiateWithPosition("Michau", [1000, 1000]) as Enemy;
            distant.Weapon = null;
            distant.Velocity = 0;
            let reads = 0;
            let solid = false;
            Object.defineProperty(distant, "IsSolid", {
                configurable: true,
                get: () => {
                    reads++;
                    return solid;
                },
            });
            player.Transform.X = 130;
            if (operation === "world step") core.step();
            else
                simulateMovement(player, core.CollisionsSystem, core.Runtime.config.fixedDeltaMs, () =>
                    core.ChunksManager.rebuildOne(player),
                );
            assert.equal(player.Transform.X, 132);
            for (const collider of player.Colliders) {
                assert.equal(collider.Body.x, player.Transform.X);
                assert.equal(collider.Body.y, player.Transform.Y);
            }
            assert.equal(reads, 1, "final geometry publication does not repeat the initial policy scan");
            assert.ok(
                player.Colliders[1].Body.potentials().includes(wall.Colliders[0].Body),
                "the BVH already exposes the final corrected geometry",
            );
            solid = true;
            core.CollisionsSystem.updateCollisionsForGameObject(player);
            assert.equal(reads, 2, "the following collision query refreshes dirty policy");
            assert.equal(candidates(core.CollisionsSystem).has(distant), true);
        } finally {
            core.dispose();
        }
    });
}
