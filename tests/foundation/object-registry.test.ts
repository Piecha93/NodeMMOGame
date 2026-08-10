import assert from "node:assert/strict";
import test from "node:test";

import {GameObjectsFactory} from "../../shared/game_utils/factory/ObjectsFactory";
import {
    GameObjectsErrorContext,
    GameObjectsManager,
} from "../../shared/game_utils/factory/GameObjectsManager";
import {registerGameObjectPrefabs} from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {Transform} from "../../shared/game_utils/physics/Transform";

registerGameObjectPrefabs();

function createRuntime(
    errorSink: (error: unknown, context: GameObjectsErrorContext) => void = () => {},
): {manager: GameObjectsManager; factory: GameObjectsFactory} {
    const manager = new GameObjectsManager(errorSink);
    return {manager, factory: new GameObjectsFactory(manager)};
}

test("foundation/object-registry: managers and id sequences are isolated", () => {
    const first = createRuntime();
    const second = createRuntime();

    const firstWall = first.factory.instantiateWithPosition("Wall", [10, 10]);
    const secondWall = second.factory.instantiateWithPosition("Wall", [20, 20]);

    assert.equal(firstWall.ID, "C0");
    assert.equal(secondWall.ID, "C0");
    assert.equal(first.manager.get("C0"), firstWall);
    assert.equal(second.manager.get("C0"), secondWall);
    assert.notEqual(first.manager.get("C0"), second.manager.get("C0"));
    assert.equal(firstWall.ObjectsFactory, first.factory);
    assert.equal(secondWall.ObjectsFactory, second.factory);

    first.manager.dispose();
    second.manager.dispose();
});

test("foundation/object-registry: duplicate explicit ids never overwrite the registered object", () => {
    const {manager, factory} = createRuntime();
    const original = factory.instantiateWithPosition("Wall", [10, 10], undefined, "C7");

    assert.throws(
        () => factory.instantiateWithPosition("Wall", [20, 20], undefined, "C7"),
        /Duplicate game object id/,
    );
    assert.equal(manager.get("C7"), original);
    assert.equal(manager.ObjectsById.size, 1);

    original.destroy();
    assert.equal(manager.get("C7"), undefined);
});

test("foundation/object-registry: failed manual registration does not retain the wrong factory", () => {
    const first = createRuntime();
    const second = createRuntime();
    first.factory.instantiateWithPosition("Wall", [10, 10], undefined, "C7");

    const candidate = new GameObject(new Transform([20, 20], 32));
    candidate.ID = "C7";
    assert.throws(
        () => first.factory.instantiateManually(candidate),
        /Duplicate game object id/,
    );
    assert.throws(() => candidate.ObjectsFactory, /not attached to a factory/);

    assert.equal(second.factory.instantiateManually(candidate), candidate);
    assert.equal(candidate.ObjectsFactory, second.factory);
    assert.equal(second.manager.get("C7"), candidate);

    first.manager.dispose();
    second.manager.dispose();
});

test("foundation/object-registry: published object ids are immutable", () => {
    const {manager, factory} = createRuntime();
    const gameObject = factory.instantiateWithPosition("Wall", [10, 10], undefined, "C42");

    assert.throws(
        () => {
            gameObject.ID = "C43";
        },
        /id cannot change/,
    );
    assert.equal(gameObject.ID, "C42");
    assert.equal(manager.get("C42"), gameObject);

    gameObject.destroy();
    assert.equal(manager.ObjectsById.size, 0);
});

test("foundation/object-registry: explicit ids must match the prefab and generated ids skip collisions", () => {
    const {manager, factory} = createRuntime();

    assert.throws(
        () => factory.instantiateWithPosition("Wall", [0, 0], undefined, "A0"),
        /does not match prefab/,
    );
    assert.equal(manager.ObjectsById.size, 0);

    const restored = factory.instantiateWithPosition("Wall", [10, 10], undefined, "C0");
    const generated = factory.instantiateWithPosition("Wall", [20, 20]);
    assert.equal(generated.ID, "C1");
    assert.equal(manager.get("C0"), restored);
    assert.equal(manager.get("C1"), generated);

    manager.dispose();
});

test("foundation/object-registry: destroy cleanup and later listeners survive listener errors", () => {
    const reportedErrors: Array<{error: unknown; context: GameObjectsErrorContext}> = [];
    const {manager, factory} = createRuntime((error, context) => reportedErrors.push({error, context}));
    const calls: string[] = [];
    const gameObject = new GameObject(new Transform([10, 10], 32));
    gameObject.ID = "C42";
    gameObject.addDestroyListener(() => {
        calls.push("throwing object listener");
        throw new Error("object listener failed");
    });
    gameObject.addDestroyListener(() => calls.push("later object listener"));
    manager.subscribe({
        destroyed: () => {
            calls.push("throwing subscriber");
            throw new Error("subscriber failed");
        },
    });
    manager.subscribe({destroyed: () => calls.push("later subscriber")});
    factory.instantiateManually(gameObject);

    assert.throws(() => gameObject.destroy(), AggregateError);
    assert.deepEqual(calls, [
        "throwing object listener",
        "later object listener",
        "throwing subscriber",
        "later subscriber",
    ]);
    assert.equal(manager.get("C42"), undefined);
    assert.equal(reportedErrors.length, 1);
    assert.equal(reportedErrors[0].context.event, "destroyed");
});

test("foundation/object-registry: create listener errors roll registration back", () => {
    const reportedEvents: string[] = [];
    const {manager, factory} = createRuntime((_error, context) => reportedEvents.push(context.event));
    let destroyedCalls = 0;
    manager.subscribe({
        created: () => {
            throw new Error("create failed");
        },
        destroyed: () => {
            destroyedCalls++;
        },
    });

    assert.throws(
        () => factory.instantiateWithPosition("Wall", [10, 10]),
        AggregateError,
    );
    assert.equal(manager.ObjectsById.size, 0);
    assert.equal(destroyedCalls, 1);
    assert.deepEqual(reportedEvents, ["created"]);
});

test("foundation/object-registry: destroy notifications are paired with create delivery", () => {
    const {manager, factory} = createRuntime();
    const events: string[] = [];

    manager.subscribe({
        created: (gameObject) => {
            events.push("first created");
            gameObject.destroy();
        },
        destroyed: () => events.push("first destroyed"),
    });
    manager.subscribe({
        created: () => events.push("second created"),
        destroyed: () => events.push("second destroyed"),
    });

    const gameObject = factory.instantiateWithPosition("Wall", [10, 10]);

    assert.equal(gameObject.IsDestroyed, true);
    assert.equal(manager.ObjectsById.size, 0);
    assert.deepEqual(events, ["first created", "first destroyed"]);
});

test("foundation/object-registry: unsubscribe is idempotent", () => {
    const {manager, factory} = createRuntime();
    let createdCalls = 0;
    let destroyedCalls = 0;
    const unsubscribe = manager.subscribe({
        created: () => createdCalls++,
        destroyed: () => destroyedCalls++,
    });

    unsubscribe();
    unsubscribe();

    const gameObject = factory.instantiateWithPosition("Wall", [10, 10]);
    gameObject.destroy();
    assert.equal(createdCalls, 0);
    assert.equal(destroyedCalls, 0);
});
