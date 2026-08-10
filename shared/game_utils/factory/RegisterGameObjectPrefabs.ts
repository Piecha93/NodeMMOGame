import {Doors} from "../game/objects/Doors";
import {Enemy} from "../game/objects/Enemy";
import {FireBall} from "../game/objects/FireBall";
import {Item} from "../game/objects/Item";
import {Obstacle} from "../game/objects/Obstacle";
import {PlatformTriggerTest} from "../game/objects/PlatformTriggerTest";
import {Player} from "../game/objects/Player";
import {Portal} from "../game/objects/Portal";
import {Prefabs} from "./GameObjectPrefabs";

let prefabsRegistered: boolean = false;

export function registerGameObjectPrefabs() {
    if (prefabsRegistered) {
        return;
    }

    prefabsRegistered = true;
    Prefabs.Register("DefaultPlayer", Player, {spriteName: "template"});
    Prefabs.Register("Michau", Enemy, {spriteName: "template", name: "Michau", prefabSize: [32, 32]});
    Prefabs.Register("Wall", Obstacle, {spriteName: "wall"});
    Prefabs.Register("HpPotion", Item, {spriteName: "hp_potion"});
    Prefabs.Register("Doors", Doors, {spriteName: "doors_closed"});
    Prefabs.Register("FireBall", FireBall, {spriteName: "flame", prefabSize: 15});
    Prefabs.Register("Portal", Portal, {spriteName: "portal", prefabSize: 75});
    Prefabs.Register("PlatformTriggerTest", PlatformTriggerTest, {prefabSize: [100, 100]});
}
