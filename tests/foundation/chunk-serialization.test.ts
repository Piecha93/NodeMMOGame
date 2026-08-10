import assert from "node:assert/strict";
import {test} from "node:test";

import {ChunksManager} from "../../shared/chunks/ChunksManager";
import {GameObjectsFactory} from "../../shared/game_utils/factory/ObjectsFactory";
import {registerGameObjectPrefabs} from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import {GameObjectsManager} from "../../shared/game_utils/factory/GameObjectsManager";
import {Obstacle} from "../../shared/game_utils/game/objects/Obstacle";

registerGameObjectPrefabs();

test("foundation/chunk serialization: reload preserves wire IDs and deserializes each object once", () => {
    const originalCreateCallbacks = GameObjectsFactory.CreateCallbacks.slice();
    const originalDestroyCallbacks = GameObjectsFactory.DestroyCallbacks.slice();
    const originalObjects = new Map(GameObjectsManager.gameObjectsMapById);
    const originalDeserialize = Obstacle.prototype.deserialize;
    let deserializeCalls: number = 0;

    Obstacle.prototype.deserialize = function(updateBufferView: DataView, offset: number): number {
        deserializeCalls++;
        return originalDeserialize.call(this, updateBufferView, offset);
    };

    try {
        const manager = new ChunksManager();
        const first = GameObjectsFactory.InstatiateWithPosition("Wall", [100, 100], undefined, "C4101");
        const second = GameObjectsFactory.InstatiateWithPosition("Wall", [200, 200], undefined, "C4102");
        const chunk = manager.getObjectChunk(first);

        assert.equal(manager.getObjectChunk(second), chunk);

        chunk.deactivate();
        assert.equal(GameObjectsManager.GetGameObjectById("C4101"), undefined);
        assert.equal(GameObjectsManager.GetGameObjectById("C4102"), undefined);

        chunk.activate();

        const restoredFirst = GameObjectsManager.GetGameObjectById("C4101");
        const restoredSecond = GameObjectsManager.GetGameObjectById("C4102");

        assert.ok(restoredFirst);
        assert.ok(restoredSecond);
        assert.deepEqual(restoredFirst.Transform.Position, [100, 100]);
        assert.deepEqual(restoredSecond.Transform.Position, [200, 200]);
        assert.equal(manager.getObjectChunk(restoredFirst), chunk);
        assert.equal(manager.getObjectChunk(restoredSecond), chunk);
        assert.equal(deserializeCalls, 2);
    } finally {
        Obstacle.prototype.deserialize = originalDeserialize;

        for (const gameObject of GameObjectsManager.gameObjectsMapById.values()) {
            if (!originalObjects.has(gameObject.ID) || originalObjects.get(gameObject.ID) !== gameObject) {
                gameObject.destroy();
            }
        }

        GameObjectsManager.gameObjectsMapById.clear();
        originalObjects.forEach((gameObject, id) => {
            GameObjectsManager.gameObjectsMapById.set(id, gameObject);
        });
        GameObjectsFactory.CreateCallbacks.splice(0, GameObjectsFactory.CreateCallbacks.length, ...originalCreateCallbacks);
        GameObjectsFactory.DestroyCallbacks.splice(0, GameObjectsFactory.DestroyCallbacks.length, ...originalDestroyCallbacks);
    }
});
