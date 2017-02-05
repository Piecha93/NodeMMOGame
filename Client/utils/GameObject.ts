import {Position} from "./Position";

export class GameObject {
    private position: Position;

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
}