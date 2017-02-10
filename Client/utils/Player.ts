import {GameObject} from "./GameObject";
import {Position} from "./Position";

export class Player extends GameObject {
    readonly name: string;
    private hp: number;

    constructor(name: string, position?: Position) {
        if(position) {
            super(position);
        } else {
            super();
        }
        this.name = name;
        this.hp = 100;
    }

    get Name(): string {
        return this.name;
    }
}