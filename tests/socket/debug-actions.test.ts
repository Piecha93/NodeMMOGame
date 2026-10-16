import { WorldContext } from "../../shared/core/WorldContext";
import assert from "node:assert/strict";
import { test } from "node:test";

import { MagicWand } from "../../shared/game_utils/game/weapons/MagicWand";
import { ObjectsSpawner } from "../../shared/game_utils/game/weapons/ObjectsSpawner";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Transform } from "../../shared/game_utils/physics/Transform";
import { InputSnapshot } from "../../shared/input/InputSnapshot";

test("socket/debug-actions: debug actions belong to a world, not the process", () => {
    const production = new Player(new Transform([0, 0]));
    const development = new Player(new Transform([100, 100]));
    development.setRuntime(new WorldContext({ enableDebugActions: true }));
    for (const player of [production, development]) player.setInput(new InputSnapshot("1=10:null"));
    assert.ok(production.Weapon instanceof MagicWand);
    assert.ok(development.Weapon instanceof ObjectsSpawner);
});
