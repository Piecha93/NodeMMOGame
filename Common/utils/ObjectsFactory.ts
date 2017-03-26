import {GameObject} from "./GameObject";
import {Player} from "./Player";

export class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }

    static CreateGameObject(className: string, data?: any): GameObject {
        if(className.toLocaleLowerCase() == "player") {
            let player: Player = new Player();
            return player.deserialize(data)
        }

        return null;
    }
}