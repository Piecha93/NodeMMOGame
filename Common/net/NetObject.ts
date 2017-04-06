import {Serializable} from "./Serializable";
import {GameObject} from "../utils/GameObject";
import GameObjectFactory = Phaser.GameObjectFactory;
import {ObjectsFactory} from "../utils/ObjectsFactory";

export class NetObject {
    private id: number;
    private gameObject: GameObject;
    constructor(id: number, gameObject?: GameObject) {
        this.id = id;
        this.gameObject = gameObject;
    }

    get GameObject(): GameObject {
        return this.gameObject;
    }

    get ID(): number {
        return this.id;
    }

    serialize(): string {
        return this.id.toString() + this.gameObject.serialize();
    }

    deserialize(update: string) {
        let splitUpdate: string[] = update.split('#');
        this.gameObject.deserialize(splitUpdate);
    }
}
