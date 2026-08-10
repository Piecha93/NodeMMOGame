import type {GameObject} from "../game/objects/GameObject";

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
