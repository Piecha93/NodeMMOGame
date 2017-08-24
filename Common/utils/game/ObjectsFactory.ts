import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {GameObjectsHolder} from "./GameObjectsHolder";
import {Types, GameObjectConstructor} from "./GameObjectTypes";
import {Enemy} from "./Enemy";

export class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    private static NEXT_ID: number = 0;

    static ObjectHolderSubscribers: Array<GameObjectsHolder> = new Array<GameObjectsHolder>();

    static CreateCallbacks: Array<Function> = new Array<Function>();
    static DestroyCallbacks: Array<Function> = new Array<Function>();

    static CreateGameObject(objectConstructor: GameObjectConstructor, id?: string, data?: string): GameObject {
        let position: Transform = new Transform(0,0);

        let gameObject: GameObject = new objectConstructor(position);

        if(id) {
            gameObject.ID = id;
        } else {
            gameObject.ID = Types.ClassToId.get(objectConstructor) + (ObjectsFactory.NEXT_ID++).toString()
        }

        if(data) {
            gameObject.deserialize(data);
        }

        ObjectsFactory.ObjectHolderSubscribers.forEach((subscriber: GameObjectsHolder) => {
            subscriber.addGameObject(gameObject);
        });
        ObjectsFactory.CreateCallbacks.forEach((callback: Function) => {
            callback(gameObject);
        });
        ObjectsFactory.DestroyCallbacks.forEach((callback: Function) => {
            gameObject.addDestroyListener(callback);
        });
        // console.log("New object " + gameObject.ID);

        return gameObject;
    }
}