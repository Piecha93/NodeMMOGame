import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";

const changesMap: Map<string, Function> = new Map<string, Function>([
    ['hp', serializeHp],
    ['name', serializeName]
]);

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
            //this.position.X += (this.destination.X - this.position.X) / 10;
            //this.position.Y += (this.destination.Y - this.position.Y) / 10;

            this.position.X = this.destination.X;
            this.position.Y = this.destination.Y;

            this.destination = null;
            this.changes.add('position');
        }
        this.hit(Math.floor(Math.random() * 100));
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

    get HP(): number {
        return this.hp;
    }

    serialize(complete: boolean = false): string {
        let update: string = "";

        if(complete) {
            changesMap.forEach((serializeFunc: Function) => {
                    update += serializeFunc(this);
            });
        } else {
            this.changes.forEach((field: string) => {
                if (changesMap.has(field)) {
                    update += changesMap[field](this);
                    this.changes.delete(field);
                }
            });
        }

        return super.serialize(complete) + update;
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

function serializeHp(player: Player): string {
    return '#H:' + player.HP.toString();
}

function serializeName(player: Player): string {
    return '#N:' + player.name;
}