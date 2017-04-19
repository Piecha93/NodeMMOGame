import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";

export class Player extends GameObject {
    get Type(): string {
        return GameObjectType.Player.toString();
    }

    readonly name: string;
    private hp: number;
    private destination: Position;

    constructor(name: string, position: Position) {
        super(position);

        this.name = name;
        this.hp = 100;
        this.destination = null;
    }

    update() {
        super.update();
        if(this.destination) {
            this.position.X += (this.destination.X - this.position.X) / 10;
            this.position.Y += (this.destination.Y - this.position.Y) / 10;
        }
        this.hit(Math.floor(Math.random() * 100));
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