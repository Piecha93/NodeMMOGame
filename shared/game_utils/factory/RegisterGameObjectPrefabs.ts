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

export const DEFAULT_PREFAB_IDS = Object.freeze({
    DefaultPlayer: "A",
    Michau: "B",
    Wall: "C",
    HpPotion: "D",
    Doors: "E",
    FireBall: "F",
    Portal: "G",
    PlatformTriggerTest: "H",
} as const);

export function registerGameObjectPrefabs() {
    if (prefabsRegistered) {
        return;
    }

    for(const [name, id] of Object.entries(DEFAULT_PREFAB_IDS)) {
        if(Prefabs.PrefabsNameToId.has(name)) {
            throw new Error(`Default prefab name '${name}' is already registered`);
        }
        if(Prefabs.IdToPrefabNames.has(id)) {
            throw new Error(`Default prefab id '${id}' is already registered`);
        }
    }

    Prefabs.Register("DefaultPlayer", Player, {spriteName: "template"}, DEFAULT_PREFAB_IDS.DefaultPlayer);
    Prefabs.Register("Michau", Enemy, {spriteName: "template", name: "Michau", prefabSize: [32, 32]}, DEFAULT_PREFAB_IDS.Michau);
    Prefabs.Register("Wall", Obstacle, {spriteName: "wall"}, DEFAULT_PREFAB_IDS.Wall);
    Prefabs.Register("HpPotion", Item, {spriteName: "hp_potion"}, DEFAULT_PREFAB_IDS.HpPotion);
    Prefabs.Register("Doors", Doors, {spriteName: "doors_closed"}, DEFAULT_PREFAB_IDS.Doors);
    Prefabs.Register("FireBall", FireBall, {spriteName: "flame", prefabSize: 15}, DEFAULT_PREFAB_IDS.FireBall);
    Prefabs.Register("Portal", Portal, {spriteName: "portal", prefabSize: 75}, DEFAULT_PREFAB_IDS.Portal);
    Prefabs.Register("PlatformTriggerTest", PlatformTriggerTest, {prefabSize: [100, 100]}, DEFAULT_PREFAB_IDS.PlatformTriggerTest);
    prefabsRegistered = true;
}
