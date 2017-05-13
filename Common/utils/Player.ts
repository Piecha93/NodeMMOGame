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
    private direction: number;
    private speed = 10;

    constructor(name: string, position: Position) {
        super(position);

        this.name = name;
        this.hp = 100;
        this.destination = null;
    }

    public setInput(commands: Map<string, string> ) {
        commands.forEach((value: string, key: string) => {
            if(key == "D") {
                this.direction = parseInt(value);
            }
        });
    }

    public update() {
        super.update();

        let xFactor: number = 0;
        let yFactor: number = 0;
        if(this.direction == 1) {
            yFactor = -1;
        } else if(this.direction == 2) {
            xFactor = 0.7071;
            yFactor = -0.7071;
        } else if(this.direction == 3) {
            xFactor = 1;
        } else if(this.direction == 4) {
            xFactor = 0.7071;
            yFactor = 0.7071;
        } else if(this.direction == 5) {
            yFactor = 1;
        } else if(this.direction == 6) {
            xFactor = -0.7071;
            yFactor = 0.7071;
        } else if(this.direction == 7) {
            xFactor = -1;
        } else if(this.direction == 8) {
            xFactor = -0.7071;
            yFactor = -0.7071;
        }
        this.position.X += xFactor * this.speed;
        this.position.Y += yFactor * this.speed;
        this.changes.add('position');
    }

    get Destination(): Position {
        return this.destination;
    }

    set Destination(destination: Position) {
        this.destination = destination;
    }

    set Direction(direction: number) {
        if(direction >= 0 && direction <= 8) {
            this.direction = direction;
        }
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

    get Direction(): number {
        return this.direction;
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

