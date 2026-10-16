import assert from "node:assert/strict";
import test from "node:test";
import { Collision } from "../shared/game_utils/physics/Collision";
import { CollisionsSystem } from "../shared/game_utils/physics/CollisionsSystem";
import { GameObject } from "../shared/game_utils/game/objects/GameObject";
import { Transform } from "../shared/game_utils/physics/Transform";
import { Body } from "detect-collisions";
import { WorldContext } from "../shared/core/WorldContext";
import { Origin } from "../shared/SharedConfig";

class CollisionProbe extends GameObject {
    public enters: number = 0;
    public stays: number = 0;
    public exits: number = 0;
    public lastExit?: Collision;
    public onEnter?: (collision: Collision) => void;
    public onStay?: (collision: Collision) => void;
    public onExit?: (collision: Collision) => void;

    constructor(x: number, y: number) {
        super(new Transform([x, y], 10));
    }

    protected sharedOnCollisionEnter(collision: Collision) {
        this.enters++;
        this.onEnter?.(collision);
    }

    protected sharedOnCollisionStay(collision: Collision) {
        this.stays++;
        this.onStay?.(collision);
    }

    protected sharedOnCollisionExit(collision: Collision) {
        this.exits++;
        this.lastExit = collision;
        this.onExit?.(collision);
    }
}

test("collision exit reports the pair that stopped colliding", () => {
    const system = new CollisionsSystem();
    const first = new CollisionProbe(0, 0);
    const second = new CollisionProbe(5, 0);

    system.insertObject(first);
    system.insertObject(second);
    system.update();
    system.updateCollisionsForGameObject(first);

    assert.equal(first.enters, 1);

    second.Transform.X = 100;
    second.updateColliders();
    system.update();
    system.updateCollisionsForGameObject(first);

    assert.equal(first.exits, 1);
    assert.ok(first.lastExit);
    assert.equal(first.lastExit.Result.collision, false);
    assert.equal(first.lastExit.Result.a, first.Colliders[0].Body);
    assert.equal(first.lastExit.Result.b, second.Colliders[0].Body);
    assert.equal(first.lastExit.Result.overlap, 0);
});

test("polygon colliders follow transform rotation", () => {
    const object = new CollisionProbe(0, 0);

    object.Transform.Rotation = Math.PI / 3;
    object.updateColliders();

    assert.equal(object.Colliders[0].Rotation, Math.PI / 3);
});

interface CollisionSystemState {
    bodyToColliderMap: Map<Body, unknown>;
    collidingBodiesMap: Map<Body, Set<Body>>;
}

function insertTrackedProbe(system: CollisionsSystem, x: number): CollisionProbe {
    const object = new CollisionProbe(x, 0);
    object.addDestroyListener(() => system.removeObject(object));
    system.insertObject(object);
    return object;
}

function assertBodyRemoved(system: CollisionsSystem, body: Body): void {
    const state = system as unknown as CollisionSystemState;
    assert.equal(state.bodyToColliderMap.has(body), false, "destroyed body is not registered");
    assert.equal(state.collidingBodiesMap.has(body), false, "destroyed body has no collision history");
    for (const contacts of state.collidingBodiesMap.values()) {
        assert.equal(contacts.has(body), false, "live collision history does not retain a destroyed body");
    }
}

for (const event of ["enter", "stay", "exit"] as const) {
    test(`destroying the source in collision ${event} removes its physics state`, () => {
        const system = new CollisionsSystem();
        const source = insertTrackedProbe(system, 0);
        const target = insertTrackedProbe(system, 5);

        if (event === "enter") {
            source.onEnter = () => source.destroy();
        } else if (event === "stay") {
            source.onStay = () => source.destroy();
        } else {
            system.update();
            system.updateCollisionsForGameObject(source);
            source.onExit = () => source.destroy();
            target.Transform.X = 100;
            target.updateColliders();
        }

        system.update();
        system.updateCollisionsForGameObject(source);

        assert.equal(source.IsDestroyed, true);
        assertBodyRemoved(system, source.Colliders[0].Body);

        // Processing an already destroyed object must not recreate its indices.
        system.updateCollisionsForGameObject(source);
        assertBodyRemoved(system, source.Colliders[0].Body);
        target.destroy();
    });
}

for (const event of ["enter", "stay"] as const) {
    test(`destroying the target in collision ${event} leaves no retained contact`, () => {
        const system = new CollisionsSystem();
        const source = insertTrackedProbe(system, 0);
        const target = insertTrackedProbe(system, 5);
        if (event === "enter") {
            source.onEnter = () => target.destroy();
        } else {
            source.onStay = () => target.destroy();
        }

        system.update();
        system.updateCollisionsForGameObject(source);

        assert.equal(target.IsDestroyed, true);
        assertBodyRemoved(system, target.Colliders[0].Body);
        source.destroy();
    });
}

test("colliders belonging to the same object do not produce collision or trigger events", () => {
    const system = new CollisionsSystem();
    const object = new CollisionProbe(0, 0);
    object.addCollider(15).IsTriger = true;
    let triggers = 0;
    object.onTriggerEnter = () => triggers++;
    object.onTriggerStay = () => triggers++;
    system.insertObject(object);

    system.update();
    system.updateCollisionsForGameObject(object);
    system.updateCollisionsForGameObject(object);

    assert.equal(object.enters, 0);
    assert.equal(object.stays, 0);
    assert.equal(triggers, 0);
    system.removeObject(object);
});

test("destroying an object during a collision batch does not skip the next object", () => {
    const system = new CollisionsSystem();
    const first = insertTrackedProbe(system, 0);
    const second = insertTrackedProbe(system, 5);
    const target = insertTrackedProbe(system, 10);
    const objects = [first, second, target];
    first.addDestroyListener(() => objects.splice(objects.indexOf(first), 1));
    first.onEnter = () => first.destroy();

    system.update();
    system.updateCollisions(objects);

    assert.equal(first.IsDestroyed, true);
    assert.equal(second.enters, 1);
    second.destroy();
    target.destroy();
});

test("client collision: remote replicas stay authoritative and remain local collision targets", () => {
    const system = new CollisionsSystem();
    const runtime = new WorldContext({ role: Origin.CLIENT });
    const local = new CollisionProbe(0, 0);
    const remote = new CollisionProbe(5, 0);
    local.setRuntime(runtime);
    remote.setRuntime(runtime);
    remote.predictionEnabled = false;
    system.insertObject(local);
    system.insertObject(remote);
    system.update();
    system.updateCollisions([remote, local]);
    assert.equal(remote.enters, 0);
    assert.equal(remote.stays, 0);
    assert.equal(local.enters, 1);
    assert.equal(local.stays, 1);
    assert.deepEqual(remote.Transform.Position, [5, 0]);
    system.removeObject(local);
    system.removeObject(remote);
});
