import {Serializable} from "../Serializable";

export class Position implements Serializable<Position> {
    private x: number;
    private y: number;

    constructor(x?: number, y?: number) {
        this.x = x || 0;
        this.y = y || 0;
    }

    get X(): number {
        return this.x;
    }

    get Y(): number {
        return this.y;
    }

    set X(x: number) {
        this.x = x;
    }

    set Y(y: number) {
        this.y = y;
    }

    deserialize(input) {
        this.x = input.x;
        this.y = input.y;

        return this;
    }

    clone(position: Position) {
        this.x = position.x;
        this.y = position.y;

        return new Position(position.x, position.y);
    }
}