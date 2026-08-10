import assert from "node:assert/strict";
import test from "node:test";
import {GameObjectsFactory} from "../shared/game_utils/factory/ObjectsFactory";
import {registerGameObjectPrefabs} from "../shared/game_utils/factory/RegisterGameObjectPrefabs";

registerGameObjectPrefabs();

test("factory rejects unknown prefabs with a controlled error", () => {
    assert.throws(
        () => GameObjectsFactory.InstatiateWithPosition("missing", [0, 0]),
        /Unknown prefab/
    );
});

test("factory rejects non-finite positions", () => {
    assert.throws(
        () => GameObjectsFactory.InstatiateWithPosition("Wall", [Number.NaN, 0]),
        /Invalid position/
    );
});
