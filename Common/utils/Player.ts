import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";
import {SerializeFunctions, DeserializeFunctions} from "./SerializeFunctionsMap";

export class Player extends GameObject {
    get Type(): string {
        return GameObjectType.Player.toString();
    }

    private name: string;
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

    get Name(): string {
        return this.name;
    }

    static serializeHp(player: Player): string {
        return '#H:' + player.HP.toString();
    }

    static deserializeHp(player: Player, data: string) {
        player.hp = parseInt(data);
    }

    static serializeName(player: Player): string {
        return '#N:' + player.name;
    }

    static deserializeName(player: Player, data: string) {
        player.name = data;
    }
}

SerializeFunctions.set('hp', Player.serializeHp);
SerializeFunctions.set('name', Player.serializeName);

DeserializeFunctions.set('H', Player.deserializeHp);
DeserializeFunctions.set('N', Player.deserializeName);

