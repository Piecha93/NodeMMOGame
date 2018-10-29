import {GameObject} from "../game/objects/GameObject";
import {Transform, Vector2, Size} from "../physics/Transform";
import {PrefabOptions, Prefabs} from "./GameObjectPrefabs";
import {GameObjectsManager} from "./GameObjectsManager";

export class GameObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    private static NEXT_ID: number = 0;

    static CreateCallbacks: Array<Function> = [];
    static DestroyCallbacks: Array<Function> = [];

    static setOptions(object: Object, prefabOptions: PrefabOptions) {
        for (let option in prefabOptions) {
            if(option == "prefabSize") continue;

            if(!object.hasOwnProperty(option)) {
                throw name + " does not have property " + option;
            }

            object[option] = prefabOptions[option];
        }
    }

    static InstatiateWithPosition(prefabName: string, position: Vector2, size?: Size, id?: string, data?: [DataView, number]): GameObject {
        let gameObject: GameObject;

        let prefabOptions: PrefabOptions = Prefabs.PrefabsOptions.get(prefabName);

        if(!size && prefabOptions && prefabOptions.prefabSize) {
            size = prefabOptions.prefabSize;
        }

        let transform: Transform =  new Transform(position, size);

        gameObject = new (Prefabs.PrefabsNameToTypes.get(prefabName))(transform);

        if(prefabOptions) {
            GameObjectsFactory.setOptions(gameObject, prefabOptions);
        }

        gameObject.Transform.resize();

        if(id) {
            gameObject.ID = id;
        } else {
            gameObject.ID = Prefabs.PrefabsNameToId.get(prefabName) + (GameObjectsFactory.NEXT_ID++).toString()
        }

        if(data) {
            gameObject.deserialize(data[0], data[1]);
        }

        GameObjectsFactory.AddToListeners(gameObject);

        return gameObject;
    }

    static Instatiate(prefabName: string, id?: string, data?: [DataView, number]): GameObject {
        return GameObjectsFactory.InstatiateWithPosition(prefabName, [0, 0], null, id, data);
    }

    static InstatiateManually(gameObject: GameObject) {
        GameObjectsFactory.AddToListeners(gameObject);

        return gameObject;
    }

    private static AddToListeners(gameObject: GameObject) {
        GameObjectsManager.gameObjectsMapById.set(gameObject.ID, gameObject);

        GameObjectsFactory.DestroyCallbacks.forEach((callback: Function) => {
            gameObject.addDestroyListener(callback);
        });

        gameObject.addDestroyListener(() => {
            GameObjectsManager.gameObjectsMapById.delete(gameObject.ID);
        });

        GameObjectsFactory.CreateCallbacks.forEach((callback: Function) => {
            if(gameObject.IsDestroyed) {
                //do not call create callbacks if game object is destroyed during creation!
                return;
            }
            callback(gameObject);
        });
    }
}