import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";
import {ChangesDict} from "./ChangesDict";
import {ObjectsFactory} from "./ObjectsFactory";
import {Bullet} from "./Bullet";

export class Player extends GameObject {
    get Type(): string {
        return GameObjectType.Player.toString();
    }

    private name: string;
    private hp: number;
    private destination: Position;
    private moveDirection: number = 0;

    constructor(name: string, position: Position) {
        super(position);
        this.id = this.Type + this.id;

        this.sFunc = new Map<string, Function>(function*() { yield* Player.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map<string, Function>(function*() { yield* Player.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
        this.name = name;
        this.hp = 100;
        this.destination = null;
        this.velocity = 0.5;
    }

    public setInput(commands: Map<string, string> ) {
        commands.forEach((value: string, command: string) => {
            if(command == "D") {
                this.moveDirection = parseInt(value);
            } else if(command == "C") {
                for(let i = 0; i < 1; i++) {
                    let bullet: Bullet = ObjectsFactory.CreateGameObject("B") as Bullet;

                    let clickX: number = parseFloat(value.split(';')[0]);
                    let clickY: number = parseFloat(value.split(';')[1]);

                    let deltaX = clickX - this.position.X;
                    let deltaY = clickY - this.position.Y;

                    let angle: number = Math.atan2(deltaY, deltaX);

                     if (angle < 0)
                         angle = angle + 2*Math.PI;

                    bullet.DirectionAngle = angle;

                    bullet.Position.X = this.position.X;
                    bullet.Position.Y = this.position.Y;
                }
            }
        });
    }

    public update(delta: number) {
        super.update(delta);

        let xFactor: number = 0;
        let yFactor: number = 0;
        if(this.moveDirection == 1) {
            yFactor = -1;
        } else if(this.moveDirection == 2) {
            xFactor = 0.7071;
            yFactor = -0.7071;
        } else if(this.moveDirection == 3) {
            xFactor = 1;
        } else if(this.moveDirection == 4) {
            xFactor = 0.7071;
            yFactor = 0.7071;
        } else if(this.moveDirection == 5) {
            yFactor = 1;
        } else if(this.moveDirection == 6) {
            xFactor = -0.7071;
            yFactor = 0.7071;
        } else if(this.moveDirection == 7) {
            xFactor = -1;
        } else if(this.moveDirection == 8) {
            xFactor = -0.7071;
            yFactor = -0.7071;
        }
        this.position.X += xFactor * this.velocity * delta;
        this.position.Y += yFactor * this.velocity * delta;

        if(this.moveDirection != 0) {
            this.changes.add(ChangesDict.POSITION);
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
            this.moveDirection = direction;
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

    set Name(name: string) {
        this.name = name;
    }

    get Direction(): number {
        return this.moveDirection;
    }

    static serializeHp(player: Player): string {
        return ChangesDict.buildTag(ChangesDict.HP) + player.HP.toString();
    }

    static deserializeHp(player: Player, data: string) {
        player.hp = parseInt(data);
    }

    static serializeName(player: Player): string {
            return ChangesDict.buildTag(ChangesDict.NAME) +  player.name;
    }

    static deserializeName(player: Player, data: string) {
        player.name = data;
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.HP, Player.serializeHp],
        [ChangesDict.NAME, Player.serializeName],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.HP, Player.deserializeHp],
        [ChangesDict.NAME, Player.deserializeName],
    ]);
}

