import {GameObject} from "./GameObject";
import {Player} from "./Player";
import {Transform} from "../physics/Transform";
import {Bullet} from "./Bullet";
import {GameObjectsHolder} from "./GameObjectsHolder";
import {Obstacle} from "./Obstacle";
import {Enemy} from "./Enemy";

export class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    static HolderSubscribers: Array<GameObjectsHolder> = new Array<GameObjectsHolder>();
    static DestroySubscribers: Array<Function> = new Array<Function>();

    static CreateGameObject(id: string, data?: string): GameObject {
        let type: string =  id.substr(0, 1);
        let position: Transform = new Transform(0,0);

        let gameObject: GameObject = null;

        if(type == "P") {
            gameObject = new Player('DEFAULT', position);
        } else if(type == "E") {
            gameObject = new Enemy("MONSTER", position);
        } else if(type == "B") {
            gameObject = new Bullet(position);
        } else if(type == "O") {
            gameObject = new Obstacle(position);
        } else {
            throw "Unknown object type";
        }

        if(gameObject) {
            if(data) {
                gameObject.deserialize(data.split('#'));
            }

            if(id.length > 1) {
                gameObject.ID = id;
            }

            ObjectsFactory.HolderSubscribers.forEach((subscriber: GameObjectsHolder) => {
                subscriber.addGameObject(gameObject);
            });

            ObjectsFactory.DestroySubscribers.forEach((subscriber: Function) => {
                gameObject.addDestroyListener(subscriber);
            });

            console.log("New object " + gameObject.ID);
        }

        return gameObject;
    }
}