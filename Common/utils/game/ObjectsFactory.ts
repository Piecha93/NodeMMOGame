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

    static HolderSubscribers: Array<GameObjectsHolder> = new Array<GameObjectsHolder>();
    static DestroySubscribers: Array<Function> = new Array<Function>();

    static CreateGameObject<T extends GameObject>(objectConstructor: GameObjectConstructor, id?: string, data?: string): GameObject {
        let position: Transform = new Transform(0,0);

        let gameObject: GameObject = new objectConstructor(position);

        if(id) {
            gameObject.ID = id;
        } else {
            gameObject.ID = Types.ClassToId.get(objectConstructor) + (ObjectsFactory.NEXT_ID++).toString()
        }

        if(data) {
            gameObject.deserialize(data.split('#'));
        }

        ObjectsFactory.HolderSubscribers.forEach((subscriber: GameObjectsHolder) => {
            subscriber.addGameObject(gameObject);
        });
        ObjectsFactory.DestroySubscribers.forEach((subscriber: Function) => {
            gameObject.addDestroyListener(subscriber);
        });
        // console.log("New object " + gameObject.ID);

        return gameObject;
    }
}