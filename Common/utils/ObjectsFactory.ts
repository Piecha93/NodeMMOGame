import {GameObject} from "./GameObject";
import {Player} from "./Player";
import {Position} from "./Position";

export class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    static CreateGameObject(id: string): GameObject {
        let type: string =  id.substr(0, 1);
        if(type == "P") {
            let player: Player = new Player('DEFAULT', new Position(0, 0));
            return player;
        }

        return null;
    }
}