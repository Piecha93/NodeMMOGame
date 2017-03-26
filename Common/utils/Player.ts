import {GameObject} from "./GameObject";
import {Position} from "./Position";

export class Player extends GameObject {
    readonly name: string;
    private hp: number;
    private destination: Position;

    constructor(name?: string, position?: Position) {
        if(position) {
            super(position);
        } else {
            super();
        }

        this.name = name || "NoName";
        this.hp = 100;
        this.destination = null;
    }

    get Name(): string {
        return this.name;
    }

    get Destination(): Position {
        return this.destination;
    }

    set Destination(destination: Position) {
        this.destination = destination;
    }

    deserialize(input: any) {
        if(!input) {
            return this;
        }
        super.deserialize(input);

        if (input.hp) {
            this.hp = input.hp;
        }

        return this;
    }
}