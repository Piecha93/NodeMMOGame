import type { Transform, Size } from "../physics/Transform";
import type { GameObject } from "../game/objects/GameObject";

export interface Constructor<T> {
    new (transform: Transform): T;
    prototype: T;
}

export interface PrefabOptions {
    prefabSize?: Size;
    spriteName?: string;
    name?: string;
}

export class PrefabCatalog {
    private readonly DESTROY_OBJECTS_ID = 0xff;

    PrefabsNameToId = new Map<string, string>();

    IdToPrefabNames = new Map<string, string>();

    PrefabsNameToTypes: Map<string, Constructor<GameObject>> = new Map<string, Constructor<GameObject>>();

    PrefabsOptions: Map<string, PrefabOptions> = new Map<string, PrefabOptions>();

    private shortIdCounter = 65;

    Register(
        name: string,
        gameObjectType: Constructor<GameObject>,
        prefabOptions?: PrefabOptions,
        explicitShortId?: string,
    ) {
        if (this.PrefabsNameToId.has(name)) {
            throw new Error(`Prefab name '${name}' is already registered`);
        }

        let shortId: string;
        if (explicitShortId === undefined) {
            shortId = this.allocateShortId();
        } else {
            this.validateShortId(explicitShortId);
            shortId = explicitShortId;
        }

        if (this.IdToPrefabNames.has(shortId)) {
            throw new Error(`Prefab id ${this.describeShortId(shortId)} is already registered`);
        }

        this.PrefabsNameToTypes.set(name, gameObjectType);
        this.PrefabsNameToId.set(name, shortId);
        this.IdToPrefabNames.set(shortId, name);

        this.PrefabsOptions.set(name, prefabOptions ?? {});
    }

    private allocateShortId(): string {
        while (this.shortIdCounter < this.DESTROY_OBJECTS_ID) {
            const shortId = String.fromCharCode(this.shortIdCounter++);
            if (!this.IdToPrefabNames.has(shortId)) {
                return shortId;
            }
        }

        throw new Error("Prefab id space is exhausted");
    }

    private validateShortId(shortId: string): void {
        if (typeof shortId !== "string" || shortId.length !== 1 || shortId.charCodeAt(0) > 0xff) {
            throw new Error("Prefab id must be exactly one byte");
        }

        if (shortId.charCodeAt(0) === this.DESTROY_OBJECTS_ID) {
            throw new Error("Prefab id 0xFF is reserved for destroyed-object messages");
        }
    }

    private describeShortId(shortId: string): string {
        return `0x${shortId.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`;
    }
}

/** Legacy registration API. Each GameCore receives its own catalog instead. */
export class Prefabs {
    static readonly Default = new PrefabCatalog();
    static get PrefabsNameToId() {
        return this.Default.PrefabsNameToId;
    }
    static get IdToPrefabNames() {
        return this.Default.IdToPrefabNames;
    }
    static get PrefabsNameToTypes() {
        return this.Default.PrefabsNameToTypes;
    }
    static get PrefabsOptions() {
        return this.Default.PrefabsOptions;
    }
    static Register(name: string, type: Constructor<GameObject>, options?: PrefabOptions, id?: string) {
        this.Default.Register(name, type, options, id);
    }
}
