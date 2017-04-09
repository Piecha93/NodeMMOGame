import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType, TypeIdMap} from "./GameObjectTypes";

export class Player extends GameObject {
    get Type(): string {
        return GameObjectType.Player.toString();
    }

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

    hit(power: number) {
        this.hp += power;
        if(this.hp < 0) {
            this.hp = 0;
        }
    }

    get Position(): Position {
        return this.position;
    }

    serialize(): string {
        let hp: string = '#H:' + this.hp.toString();
        let name: string = '#N:' + this.name;

        return super.serialize() + hp + name;
    }

    deserialize(update: string[]) {
        super.deserialize(update);
        for(let item of update) {
            if(item.startsWith('H')) {
                this.hp = parseInt(item.split(':')[1]);
            }
        }
    }
}