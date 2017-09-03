import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {GameObjectsHolder} from "./GameObjectsHolder";
import {Player} from "./Player";
import {Enemy} from "./Enemy";
import {Obstacle} from "./Obstacle";
import {Bullet} from "./Bullet";
import {Types} from "./GameObjectTypes";


export class GameObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    private static NEXT_ID: number = 0;

    static ObjectHolderSubscribers: Array<GameObjectsHolder> = [];

    static CreateCallbacks: Array<Function> = [];
    static DestroyCallbacks: Array<Function> = [];

    static Instatiate(type: string, id?: string, data?: string): GameObject {

        let position: Transform = new Transform(0,0,32,32);
        let gameObject: GameObject;

        if(type == "Player") {
            gameObject = new Player(position);
        } else if(type == "Enemy") {
            gameObject = new Enemy(position);
        } else if(type == "Bullet") {
            gameObject = new Bullet(position);
        } else if(type == "Obstacle") {
            gameObject = new Obstacle(position);
        }

        if(id) {
            gameObject.ID = id;
        } else {
            gameObject.ID = Types.ClassToId.get(type) + (GameObjectsFactory.NEXT_ID++).toString()
        }

        if(data) {
            gameObject.deserialize(data);
        }

        GameObjectsFactory.ObjectHolderSubscribers.forEach((subscriber: GameObjectsHolder) => {
            subscriber.addGameObject(gameObject);
        });
        GameObjectsFactory.CreateCallbacks.forEach((callback: Function) => {
            callback(gameObject);
        });
        GameObjectsFactory.DestroyCallbacks.forEach((callback: Function) => {
            gameObject.addDestroyListener(callback);
        });
        // console.log("New object " + gameObject.ID);

        return gameObject;
    }
}