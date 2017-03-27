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

        for(let prop in input) {
            if(this[prop] == null) {
                continue;
            }
            if(this[prop].deserialize != null) {
                this[prop].deserialize(input[prop]);
            } else {
                this[prop] =  input[prop];
            }
        }

        return this;
    }
}