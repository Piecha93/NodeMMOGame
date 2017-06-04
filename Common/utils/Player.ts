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
    private direction: number = 0;
    private speed = 10;

    constructor(name: string, position: Position) {
        super(position);
        this.id = this.Type + this.id;

        this.sFunc = new Map<string, Function>(function*() { yield* Player.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map<string, Function>(function*() { yield* Player.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
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

        if(this.direction != 0) {
            this.changes.add('position');
        }
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
        if(player instanceof Player) {
            return '#H:' + player.HP.toString();
        } else {
            return "";
        }
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

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['hp', Player.serializeHp],
        ['name', Player.serializeName],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['H', Player.deserializeHp],
        ['N', Player.deserializeName],
    ]);
}

// SerializeFunctions.set('hp', Player.serializeHp);
// SerializeFunctions.set('name', Player.serializeName);
//1
// DeserializeFunctions.set('H', Player.deserializeHp);
// DeserializeFunctions.set('N', Player.deserializeName);

