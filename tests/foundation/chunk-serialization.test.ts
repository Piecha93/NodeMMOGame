import assert from "node:assert/strict";
import { test } from "node:test";

import { GameCore } from "../../shared/GameCore";
import { registerGameObjectPrefabs } from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import { Obstacle } from "../../shared/game_utils/game/objects/Obstacle";
import { Serializable } from "../../shared/serialize/Serializable";

registerGameObjectPrefabs();

test("foundation/chunk serialization: reload preserves wire IDs and deserializes each object once", () => {
    const originalDeserialize = Serializable.prototype.deserialize;
    let deserializeCalls: number = 0;
    let core: GameCore | undefined;

    Serializable.prototype.deserialize = function (updateBufferView: DataView, offset: number): number {
        if (this instanceof Obstacle) deserializeCalls++;
        return originalDeserialize.call(this, updateBufferView, offset);
    };

    try {
        core = new GameCore();
        const first = core.ObjectsFactory.instantiateWithPosition("Wall", [100, 100], undefined, "C4101");
        const second = core.ObjectsFactory.instantiateWithPosition("Wall", [200, 200], undefined, "C4102");
        const chunk = core.ChunksManager.getObjectChunk(first);
        assert.ok(chunk);

        assert.equal(core.ChunksManager.getObjectChunk(second), chunk);

        chunk.deactivate();
        assert.equal(core.ObjectsManager.get("C4101"), undefined);
        assert.equal(core.ObjectsManager.get("C4102"), undefined);

        chunk.activate();

        const restoredFirst = core.ObjectsManager.get("C4101");
        const restoredSecond = core.ObjectsManager.get("C4102");

        assert.ok(restoredFirst);
        assert.ok(restoredSecond);
        assert.deepEqual(restoredFirst.Transform.Position, [100, 100]);
        assert.deepEqual(restoredSecond.Transform.Position, [200, 200]);
        assert.equal(core.ChunksManager.getObjectChunk(restoredFirst), chunk);
        assert.equal(core.ChunksManager.getObjectChunk(restoredSecond), chunk);
        assert.equal(deserializeCalls, 2);
    } finally {
        Serializable.prototype.deserialize = originalDeserialize;
        core?.dispose();
    }
});
