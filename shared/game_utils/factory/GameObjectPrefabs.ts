import {Obstacle} from "../game/objects/Obstacle";
import {Item} from "../game/objects/Item";
import {Player} from "../game/objects/Player";
import {GameObject} from "../game/objects/GameObject";
import {FireBall} from "../game/objects/FireBall";
import {Enemy} from "../game/objects/Enemy";
import {Portal} from "../game/objects/Portal";
import {Doors} from "../game/objects/Doors";
import {PlatformTriggerTest} from "../game/objects/PlatformTriggerTest";

export interface Constructor<T> extends Function {
    new(...params: any[]): T; prototype: T;
}

export interface PrefabOptions {
    [key: string]: any

    prefabSize?: number | [number, number];
}

export class Prefabs {
    static PrefabsNameToId = new Map<string, string>();

    static IdToPrefabNames = new Map<string, string>();

    static PrefabsNameToTypes: Map<string, Constructor<GameObject> > =
        new Map<string, Constructor<GameObject> >();

    static PrefabsOptions: Map<string, PrefabOptions> = new Map<string, PrefabOptions>();

    private static shortIdCounter = 65;

    static Register(name: string, gameObjectType: Constructor<GameObject>, prefabOptions?: PrefabOptions) {
        let shortId: string;
        shortId = String.fromCharCode(Prefabs.shortIdCounter++);

        Prefabs.PrefabsNameToTypes.set(name, gameObjectType);
        Prefabs.PrefabsNameToId.set(name, shortId);
        Prefabs.IdToPrefabNames.set(shortId, name);

        Prefabs.PrefabsOptions.set(name, prefabOptions);
    }
}

Prefabs.Register("DefaultPlayer", Player, {spriteName: "template"});
Prefabs.Register("Michau", Enemy, {spriteName: "template", name: "Michau", prefabSize: [32, 32]});
Prefabs.Register("Wall", Obstacle, {spriteName: "wall"});
Prefabs.Register("HpPotion", Item, {spriteName: "hp_potion"});
Prefabs.Register("Doors", Doors, {spriteName: "doors_closed"});
Prefabs.Register("FireBall", FireBall, {spriteName: "flame", prefabSize: 15});
Prefabs.Register("Portal", Portal, {spriteName: "portal", prefabSize: 75});
Prefabs.Register("PlatformTriggerTest", PlatformTriggerTest, {prefabSize: [100, 100]});