import {Position} from "./Position";
import {Serializable} from "../net/Serializable";

export abstract class GameObject implements Serializable<GameObject> {
    protected position: Position;

    constructor(position?: Position) {
        if(position) {
            this.position = position;
        } else {
            this.position = new Position(0, 0);
        }
    }

    get Position(): Position {
        return this.position;
    }

    deserialize(input) {
        if(!input) {
            return this;
        }
        if(input.position) {
            if (this.position) {
                this.position = this.position.deserialize(input.position);
            } else {
                this.position = new Position().deserialize(input.position);
            }
        }
        return this;
    }
}