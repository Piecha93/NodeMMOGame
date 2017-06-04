import {GameObject} from "./GameObject";
import {Player} from "./Player";
import {Position} from "./Position";
import {Bullet} from "./Bullet";

export class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    static CreateGameObject(id: string, position?: Position): GameObject {
        let type: string =  id.substr(0, 1);
        if(position == null) {
            position = new Position(0,0);
        }

        if(type == "P") {
            return new Player('DEFAULT', position);
        } else if(type == "B") {
            return new Bullet(position);
        }

        return null;
    }
}