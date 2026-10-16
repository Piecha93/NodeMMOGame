import assert from "node:assert/strict";
import test from "node:test";
import { GameObjectsFactory } from "../shared/game_utils/factory/ObjectsFactory";
import { GameObjectsManager } from "../shared/game_utils/factory/GameObjectsManager";
import { registerGameObjectPrefabs } from "../shared/game_utils/factory/RegisterGameObjectPrefabs";

registerGameObjectPrefabs();

function createFactory(): GameObjectsFactory {
    return new GameObjectsFactory(new GameObjectsManager(() => {}));
}

test("factory rejects unknown prefabs with a controlled error", () => {
    assert.throws(() => createFactory().instantiateWithPosition("missing", [0, 0]), /Unknown prefab/);
});

test("factory rejects non-finite positions", () => {
    assert.throws(() => createFactory().instantiateWithPosition("Wall", [Number.NaN, 0]), /Invalid position/);
});
