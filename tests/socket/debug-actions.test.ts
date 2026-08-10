import assert from "node:assert/strict";
import {test} from "node:test";

import {MagicWand} from "../../shared/game_utils/game/weapons/MagicWand";
import {ObjectsSpawner} from "../../shared/game_utils/game/weapons/ObjectsSpawner";
import {Player} from "../../shared/game_utils/game/objects/Player";
import {Transform} from "../../shared/game_utils/physics/Transform";
import {InputSnapshot} from "../../shared/input/InputSnapshot";

test("socket/debug-actions: production player cannot switch to the object spawner", () => {
    const previousDebugSetting = Player.EnableDebugActions;

    try {
        Player.EnableDebugActions = false;
        const player = new Player(new Transform([0, 0]));

        assert.ok(player.Weapon instanceof MagicWand);
        player.setInput(new InputSnapshot("1=10:null"));
        assert.ok(player.Weapon instanceof MagicWand);

        Player.EnableDebugActions = true;
        player.setInput(new InputSnapshot("2=10:null"));
        assert.ok(player.Weapon instanceof ObjectsSpawner);
    } finally {
        Player.EnableDebugActions = previousDebugSetting;
    }
});
