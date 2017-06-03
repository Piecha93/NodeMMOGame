import {GameObject} from "./GameObject";
import {Player} from "./Player";
import {Position} from "./Position";
import {Bullet} from "../../Common/utils/Bullet";

export class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    static CreateGameObject(id: string): GameObject {
        let type: string =  id.substr(0, 1);
        if(type == "P") {
            return new Player('DEFAULT', new Position(0, 0));
        } else if(type == "B") {
            return new Bullet();
        }

        return null;
    }
}