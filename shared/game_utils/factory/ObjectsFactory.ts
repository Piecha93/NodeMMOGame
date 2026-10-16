import { legacyView } from "../../replication/LegacyView";
import { WorldContext } from "../../core/WorldContext";
import { SharedConfig } from "../../SharedConfig";
import { GameObject } from "../game/objects/GameObject";
import { Transform, Vector2, Size } from "../physics/Transform";
import { PrefabOptions, Prefabs, PrefabCatalog } from "./GameObjectPrefabs";
import { GameObjectsManager } from "./GameObjectsManager";

export class GameObjectsFactory {
    private static readonly MAX_OBJECT_SEQUENCE = 0xffffffff;

    private readonly manager: GameObjectsManager;
    private nextId: number = 0;

    constructor(
        manager: GameObjectsManager,
        public readonly Runtime: WorldContext = new WorldContext({
            role: SharedConfig.ORIGIN,
            chunkSize: SharedConfig.chunkSize,
            numOfChunksX: SharedConfig.numOfChunksX,
            numOfChunksY: SharedConfig.numOfChunksY,
            chunkDeactivationTime: SharedConfig.chunkDeactivationTime,
        }),
        public readonly Catalog: PrefabCatalog = Prefabs.Default,
    ) {
        this.manager = manager;
    }

    public get Manager(): GameObjectsManager {
        return this.manager;
    }

    public instantiateWithPosition(
        prefabName: string,
        position: Vector2,
        size?: Size,
        id?: string,
        data?: [DataView, number],
        initialize?: (object: GameObject) => void,
    ): GameObject {
        const gameObjectType = this.Catalog.PrefabsNameToTypes.get(prefabName);
        const prefabId = this.Catalog.PrefabsNameToId.get(prefabName);
        if (!gameObjectType || !prefabId) {
            throw new Error("Unknown prefab: " + prefabName);
        }

        if (!position || position.length !== 2 || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
            throw new Error("Invalid position for prefab: " + prefabName);
        }

        const objectId =
            id === undefined ? this.allocateId(prefabId) : this.validateExplicitId(prefabName, prefabId, id);

        if (this.manager.get(objectId)) {
            throw new Error(`Duplicate game object id: ${objectId}`);
        }

        const prefabOptions: PrefabOptions | undefined = this.Catalog.PrefabsOptions.get(prefabName);
        if (!size && prefabOptions?.prefabSize) {
            size = prefabOptions.prefabSize;
        }

        const gameObject = new gameObjectType(new Transform(position, size));
        if (prefabOptions) {
            this.setOptions(gameObject, prefabOptions);
        }

        gameObject.ID = objectId;

        gameObject.setRuntime(this.Runtime);
        if (data) {
            legacyView(gameObject).deserialize(data[0], data[1]);
        }

        initialize?.(gameObject);
        gameObject.updateColliders();
        return this.registerWithOwner(gameObject);
    }

    public instantiate(prefabName: string, id?: string, data?: [DataView, number]): GameObject {
        return this.instantiateWithPosition(prefabName, [0, 0], undefined, id, data);
    }

    public instantiateManually(gameObject: GameObject): GameObject {
        if (!gameObject.ID) {
            throw new Error("Cannot instantiate a game object manually without an id");
        }

        return this.registerWithOwner(gameObject);
    }

    private setOptions(object: GameObject, prefabOptions: PrefabOptions): void {
        if (prefabOptions.spriteName !== undefined) object.SpriteName = prefabOptions.spriteName;
        if (prefabOptions.name !== undefined) {
            if (!("Name" in object)) throw new Error("Prefab does not support a name");
            (object as GameObject & { Name: string }).Name = prefabOptions.name;
        }
    }

    private registerWithOwner(gameObject: GameObject): GameObject {
        gameObject.attachObjectsFactory(this);
        try {
            return this.manager.register(gameObject);
        } catch (error) {
            gameObject.detachObjectsFactory(this);
            throw error;
        }
    }

    private allocateId(prefabId: string): string {
        while (this.nextId <= GameObjectsFactory.MAX_OBJECT_SEQUENCE) {
            const id = prefabId + (this.nextId++).toString();
            if (!this.manager.get(id)) {
                return id;
            }
        }

        throw new Error("Game object id space is exhausted");
    }

    private validateExplicitId(prefabName: string, prefabId: string, id: string): string {
        if (id[0] !== prefabId) {
            throw new Error(`Game object id '${id}' does not match prefab '${prefabName}'`);
        }

        const sequenceText = id.slice(1);
        if (!/^(0|[1-9]\d*)$/.test(sequenceText)) {
            throw new Error(`Invalid game object id: ${id}`);
        }

        const sequence = Number(sequenceText);
        if (!Number.isSafeInteger(sequence) || sequence > GameObjectsFactory.MAX_OBJECT_SEQUENCE) {
            throw new Error(`Invalid game object id: ${id}`);
        }

        return id;
    }
}
