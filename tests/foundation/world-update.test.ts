import assert from "node:assert/strict";
import test from "node:test";

import { GameWorld } from "../../shared/GameWorld";
import { ChunksManager } from "../../shared/chunks/ChunksManager";
import { GameObjectsManager } from "../../shared/game_utils/factory/GameObjectsManager";
import { GameObjectsFactory } from "../../shared/game_utils/factory/ObjectsFactory";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Transform } from "../../shared/game_utils/physics/Transform";
import { Origin, SharedConfig } from "../../shared/SharedConfig";
import { WorldContext } from "../../shared/core/WorldContext";

class UpdateProbe extends GameObject {
    readonly updates: number[] = [];
    onUpdate?: () => void;

    constructor(id: string, x: number) {
        super(new Transform([x, 100], 10));
        this.ID = id;
    }

    public update(delta: number): void {
        this.updates.push(delta);
        this.onUpdate?.();
    }
}

function createWorldFixture() {
    const manager = new GameObjectsManager();
    const factory = new GameObjectsFactory(manager);
    const chunks = new ChunksManager(manager, factory);
    const world = new GameWorld(chunks);
    manager.subscribe({
        created: (object) => {
            chunks.addObject(object);
            world.addObject(object);
        },
        destroyed: (object) => {
            chunks.removeAndReturnOldChunk(object);
            world.removeObject(object);
        },
    });

    return {
        world,
        create(id: string, x: number): UpdateProbe {
            const object = new UpdateProbe(id, x);
            factory.instantiateManually(object);
            return object;
        },
        dispose: () => manager.dispose(),
    };
}

test("foundation/world: destroying the current object does not skip the next update", () => {
    const fixture = createWorldFixture();
    try {
        const first = fixture.create("first", 100);
        const second = fixture.create("second", 300);
        first.onUpdate = () => first.destroy();

        fixture.world.update(16);

        assert.equal(first.IsDestroyed, true);
        assert.deepEqual(first.updates, [16]);
        assert.deepEqual(second.updates, [16]);
    } finally {
        fixture.dispose();
    }
});

for (const [location, x] of [
    ["the same chunk", 300],
    ["a later chunk", SharedConfig.chunkSize + 100],
] as const) {
    test(`foundation/world: objects spawned in ${location} start updating on the next tick`, () => {
        const fixture = createWorldFixture();
        try {
            const spawner = fixture.create("spawner", 100);
            let spawned: UpdateProbe | undefined;
            spawner.onUpdate = () => {
                if (!spawned) {
                    spawned = fixture.create("spawned", x);
                }
            };

            fixture.world.update(16);

            assert.ok(spawned);
            assert.deepEqual(spawned.updates, []);

            fixture.world.update(32);

            assert.deepEqual(spawner.updates, [16, 32]);
            assert.deepEqual(spawned.updates, [32]);
        } finally {
            fixture.dispose();
        }
    });
}

test("foundation/world: an object destroyed before its turn receives no update", () => {
    const fixture = createWorldFixture();
    try {
        const first = fixture.create("first", 100);
        const destroyed = fixture.create("destroyed", 300);
        const survivor = fixture.create("survivor", 500);
        first.onUpdate = () => destroyed.destroy();

        fixture.world.update(16);

        assert.equal(destroyed.IsDestroyed, true);
        assert.deepEqual(destroyed.updates, []);
        assert.deepEqual(first.updates, [16]);
        assert.deepEqual(survivor.updates, [16]);
    } finally {
        fixture.dispose();
    }
});

test("foundation/world: destruction in serverUpdate stops the remaining object callbacks", () => {
    class DestroyDuringUpdate extends GameObject {
        commonUpdates = 0;
        colliderUpdates = 0;
        protected override serverUpdate(): void {
            this.destroy();
        }
        protected override commonUpdate(): void {
            this.commonUpdates++;
        }
        override updateColliders(): void {
            this.colliderUpdates++;
        }
    }
    const object = new DestroyDuringUpdate(new Transform([0, 0], 10));
    object.setRuntime(new WorldContext({ role: Origin.SERVER }));
    object.update(16);
    assert.equal(object.IsDestroyed, true);
    assert.equal(object.commonUpdates, 0);
    assert.equal(object.colliderUpdates, 0);
});
