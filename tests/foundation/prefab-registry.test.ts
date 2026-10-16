import assert from "node:assert/strict";
import test from "node:test";

import { Prefabs } from "../../shared/game_utils/factory/GameObjectPrefabs";
import {
    DEFAULT_PREFAB_IDS,
    registerGameObjectPrefabs,
} from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import { Player } from "../../shared/game_utils/game/objects/Player";

test("foundation/prefabs: default wire ids stay stable", () => {
    registerGameObjectPrefabs();

    assert.deepEqual(Object.fromEntries(Prefabs.PrefabsNameToId), DEFAULT_PREFAB_IDS);
    assert.deepEqual(
        Object.fromEntries(Prefabs.IdToPrefabNames),
        Object.fromEntries(Object.entries(DEFAULT_PREFAB_IDS).map(([name, id]) => [id, name])),
    );
});

test("foundation/prefabs: invalid and duplicate registrations are atomic", () => {
    registerGameObjectPrefabs();

    const originalNames = new Map(Prefabs.PrefabsNameToId);
    const originalIds = new Map(Prefabs.IdToPrefabNames);
    const invalidIds = ["", "AA", "\u0100", "\u{1F600}"];

    assert.throws(() => Prefabs.Register("DefaultPlayer", Player, undefined, "I"), /name .*already registered/);
    assert.throws(
        () => Prefabs.Register("DuplicateId", Player, undefined, DEFAULT_PREFAB_IDS.DefaultPlayer),
        /id .*already registered/,
    );
    for (const invalidId of invalidIds) {
        assert.throws(() => Prefabs.Register(`Invalid-${invalidId}`, Player, undefined, invalidId), /exactly one byte/);
    }
    assert.throws(() => Prefabs.Register("ReservedId", Player, undefined, "\xFF"), /0xFF is reserved/);

    assert.deepEqual(Prefabs.PrefabsNameToId, originalNames);
    assert.deepEqual(Prefabs.IdToPrefabNames, originalIds);
});

test("foundation/prefabs: legacy registration allocates the first free id", () => {
    registerGameObjectPrefabs();

    Prefabs.Register("LegacyCustom", Player);

    assert.equal(Prefabs.PrefabsNameToId.get("LegacyCustom"), "J");
    assert.equal(Prefabs.IdToPrefabNames.get("J"), "LegacyCustom");
});
