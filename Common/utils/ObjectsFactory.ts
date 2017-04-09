import {GameObject} from "./GameObject";
import {Player} from "./Player";

export class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    static CreateGameObject(id: string): GameObject {
        let type: string =  id.substr(0, 1);
        if(type == "P") {
            let player: Player = new Player();
            return player;
        }

        return null;
    }
}