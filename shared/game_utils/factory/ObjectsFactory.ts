import {GameObject} from "../game/objects/GameObject";
import {Transform} from "../physics/Transform";
import {Types} from "./GameObjectTypes";
import {GameObjectsManager} from "./GameObjectsManager";

export class GameObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    private static NEXT_ID: number = 0;

    static CreateCallbacks: Array<Function> = [];
    static DestroyCallbacks: Array<Function> = [];

    static InstatiateWithTransform(type: string, transform: Transform, id?: string, data?: [DataView, number]): GameObject {
        let gameObject: GameObject;

        gameObject = new (Types.ClassNamesToTypes.get(type))(transform);

        if(id) {
            gameObject.ID = id;
        } else {
            gameObject.ID = Types.ClassNamesToId.get(type) + (GameObjectsFactory.NEXT_ID++).toString()
        }

        if(data) {
            gameObject.deserialize(data[0], data[1]);
        }

        GameObjectsFactory.AddToListeners(gameObject);

        return gameObject;
    }

    static Instatiate(type: string, id?: string, data?: [DataView, number]): GameObject {
        let position: Transform = new Transform(0,0,32,32);

        return GameObjectsFactory.InstatiateWithTransform(type, position, id, data);
    }

    static InstatiateManually(gameObject: GameObject) {
        GameObjectsFactory.AddToListeners(gameObject);

        return gameObject;
    }

    private static AddToListeners(gameObject: GameObject) {
        GameObjectsManager.gameObjectsMapById.set(gameObject.ID, gameObject);

        GameObjectsFactory.CreateCallbacks.forEach((callback: Function) => {
            callback(gameObject);
        });
        GameObjectsFactory.DestroyCallbacks.forEach((callback: Function) => {
            gameObject.addDestroyListener(callback);
        });

        gameObject.addDestroyListener(() => {
            GameObjectsManager.gameObjectsMapById.delete(gameObject.ID);
        });
    }
}