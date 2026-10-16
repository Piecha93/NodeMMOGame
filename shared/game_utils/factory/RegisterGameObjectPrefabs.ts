import { Doors } from "../game/objects/Doors";
import { Enemy } from "../game/objects/Enemy";
import { FireBall } from "../game/objects/FireBall";
import { Item } from "../game/objects/Item";
import { Obstacle } from "../game/objects/Obstacle";
import { PlatformTriggerTest } from "../game/objects/PlatformTriggerTest";
import { Player } from "../game/objects/Player";
import { Portal } from "../game/objects/Portal";
import { ExpeditionMarker } from "../game/objects/ExpeditionMarker";
import { Prefabs, PrefabCatalog } from "./GameObjectPrefabs";

export const DEFAULT_PREFAB_IDS = Object.freeze({
    DefaultPlayer: "A",
    Michau: "B",
    Wall: "C",
    HpPotion: "D",
    Doors: "E",
    FireBall: "F",
    Portal: "G",
    PlatformTriggerTest: "H",
    ExpeditionMarker: "I",
} as const);

export function registerGameObjectPrefabs(catalog: PrefabCatalog = Prefabs.Default) {
    if (
        catalog.PrefabsNameToTypes.get("DefaultPlayer") === Player &&
        Object.entries(DEFAULT_PREFAB_IDS).every(([name, id]) => catalog.PrefabsNameToId.get(name) === id)
    )
        return;

    for (const [name, id] of Object.entries(DEFAULT_PREFAB_IDS)) {
        if (catalog.PrefabsNameToId.has(name)) {
            throw new Error(`Default prefab name '${name}' is already registered`);
        }
        if (catalog.IdToPrefabNames.has(id)) {
            throw new Error(`Default prefab id '${id}' is already registered`);
        }
    }

    catalog.Register("DefaultPlayer", Player, { spriteName: "template" }, DEFAULT_PREFAB_IDS.DefaultPlayer);
    catalog.Register(
        "Michau",
        Enemy,
        { spriteName: "template", name: "Michau", prefabSize: [32, 32] },
        DEFAULT_PREFAB_IDS.Michau,
    );
    catalog.Register("Wall", Obstacle, { spriteName: "wall" }, DEFAULT_PREFAB_IDS.Wall);
    catalog.Register("HpPotion", Item, { spriteName: "hp_potion" }, DEFAULT_PREFAB_IDS.HpPotion);
    catalog.Register("Doors", Doors, { spriteName: "doors_closed" }, DEFAULT_PREFAB_IDS.Doors);
    catalog.Register("FireBall", FireBall, { spriteName: "flame", prefabSize: 15 }, DEFAULT_PREFAB_IDS.FireBall);
    catalog.Register("Portal", Portal, { spriteName: "portal", prefabSize: 75 }, DEFAULT_PREFAB_IDS.Portal);
    catalog.Register(
        "PlatformTriggerTest",
        PlatformTriggerTest,
        { prefabSize: [100, 100] },
        DEFAULT_PREFAB_IDS.PlatformTriggerTest,
    );
    catalog.Register(
        "ExpeditionMarker",
        ExpeditionMarker,
        { spriteName: "bluebolt", prefabSize: 32 },
        DEFAULT_PREFAB_IDS.ExpeditionMarker,
    );
}

export function createDefaultPrefabCatalog(): PrefabCatalog {
    const catalog = new PrefabCatalog();
    registerGameObjectPrefabs(catalog);
    return catalog;
}
