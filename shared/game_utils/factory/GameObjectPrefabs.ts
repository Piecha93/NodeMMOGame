import type {GameObject} from "../game/objects/GameObject";

export interface Constructor<T> extends Function {
    new(...params: any[]): T; prototype: T;
}

export interface PrefabOptions {
    [key: string]: any

    prefabSize?: number | [number, number];
}

export class Prefabs {
    private static readonly DESTROY_OBJECTS_ID = 0xFF;

    static PrefabsNameToId = new Map<string, string>();

    static IdToPrefabNames = new Map<string, string>();

    static PrefabsNameToTypes: Map<string, Constructor<GameObject> > =
        new Map<string, Constructor<GameObject> >();

    static PrefabsOptions: Map<string, PrefabOptions> = new Map<string, PrefabOptions>();

    private static shortIdCounter = 65;

    static Register(
        name: string,
        gameObjectType: Constructor<GameObject>,
        prefabOptions?: PrefabOptions,
        explicitShortId?: string,
    ) {
        if(Prefabs.PrefabsNameToId.has(name)) {
            throw new Error(`Prefab name '${name}' is already registered`);
        }

        let shortId: string;
        if(explicitShortId === undefined) {
            shortId = Prefabs.allocateShortId();
        } else {
            Prefabs.validateShortId(explicitShortId);
            shortId = explicitShortId;
        }

        if(Prefabs.IdToPrefabNames.has(shortId)) {
            throw new Error(`Prefab id ${Prefabs.describeShortId(shortId)} is already registered`);
        }

        Prefabs.PrefabsNameToTypes.set(name, gameObjectType);
        Prefabs.PrefabsNameToId.set(name, shortId);
        Prefabs.IdToPrefabNames.set(shortId, name);

        Prefabs.PrefabsOptions.set(name, prefabOptions);
    }

    private static allocateShortId(): string {
        while(Prefabs.shortIdCounter < Prefabs.DESTROY_OBJECTS_ID) {
            const shortId = String.fromCharCode(Prefabs.shortIdCounter++);
            if(!Prefabs.IdToPrefabNames.has(shortId)) {
                return shortId;
            }
        }

        throw new Error("Prefab id space is exhausted");
    }

    private static validateShortId(shortId: string): void {
        if(typeof shortId !== "string" || shortId.length !== 1 || shortId.charCodeAt(0) > 0xFF) {
            throw new Error("Prefab id must be exactly one byte");
        }

        if(shortId.charCodeAt(0) === Prefabs.DESTROY_OBJECTS_ID) {
            throw new Error("Prefab id 0xFF is reserved for destroyed-object messages");
        }
    }

    private static describeShortId(shortId: string): string {
        return `0x${shortId.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`;
    }
}
