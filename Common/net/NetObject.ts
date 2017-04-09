import {GameObject} from "../utils/GameObject";
import GameObjectFactory = Phaser.GameObjectFactory;

export class NetObject {
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

    serialize(): string {
        return this.id.toString() + this.gameObject.serialize();
    }

    deserialize(update: string) {
        let splitUpdate: string[] = update.split('#');
        this.gameObject.deserialize(splitUpdate);
    }
}
