import {Serializable} from "./Serializable";
import {GameObject} from "../utils/GameObject";
import GameObjectFactory = Phaser.GameObjectFactory;
import {ObjectsFactory} from "../utils/ObjectsFactory";

export class NetObject implements Serializable<NetObject> {
    private id: string;
    private gameObject: GameObject;

    constructor(id: string, gameObject?: GameObject) {
        this.id = id;
        this.gameObject = gameObject;
    }

    get GameObject(): GameObject {
        return this.gameObject;
    }

    get ID(): string {
        return this.id;
    }

    deserialize(input) {
        this.id = input.id;
        if(this.gameObject) {
            this.gameObject.deserialize(input.gameObject)
        } else {
            this.gameObject = ObjectsFactory.CreateGameObject("player").deserialize(input.gameObject);
        }
        return this;
    }
}