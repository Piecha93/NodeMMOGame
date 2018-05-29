import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {GameObjectsSubscriber} from "./GameObjectsSubscriber";
import {Player} from "./Player";
import {Enemy} from "./Enemy";
import {Obstacle} from "./Obstacle";
import {Bullet} from "./Bullet";
import {Types} from "./GameObjectTypes";

export class GameObjectsContainer {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    static gameObjectsMapById: Map<string, GameObject> = new Map<string, GameObject>();
}

export class GameObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    private static NEXT_ID: number = 0;

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

        GameObjectsContainer.gameObjectsMapById.set(gameObject.ID, gameObject);

        GameObjectsFactory.CreateCallbacks.forEach((callback: Function) => {
            callback(gameObject);
        });
        GameObjectsFactory.DestroyCallbacks.forEach((callback: Function) => {
            gameObject.addDestroyListener(callback);
        });

        gameObject.addDestroyListener(() => {
            GameObjectsContainer.gameObjectsMapById.delete(gameObject.ID);
        });

        return gameObject;
    }
}