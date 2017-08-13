import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {GameObjectType} from "./GameObjectTypes";
import {ChangesDict} from "./ChangesDict";
import {ObjectsFactory} from "./ObjectsFactory";
import {Bullet} from "./Bullet";

export class Player extends GameObject {
    get Type(): string {
        return GameObjectType.Player.toString();
    }

    private name: string;
    private maxHp: number;
    private hp: number;
    private moveDirection: number = 0;

    private inputCommands: Map<string, string> = new Map<string, string>();

    constructor(name: string, transform: Transform) {
        super(transform);
        this.id = this.Type + this.id;

        this.sFunc = new Map<string, Function>(function*() { yield* Player.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map<string, Function>(function*() { yield* Player.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
        this.name = name;

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;

        this.transform.Width = 40;
        this.transform.Height = 64;

        this.spriteName = "bunny";
    }

    protected serverCollision(gameObject: GameObject, response: SAT.Response) {
        if(gameObject.Type == GameObjectType.Bullet.toString()) {
            if((gameObject as Bullet).Owner == this.ID) {
                return;
            }
            this.hit(10);
        }
    }

    protected commonCollision(gameObject: GameObject, response: SAT.Response) {
        if(gameObject.Type == GameObjectType.Obstacle.toString()) {
            this.transform.X += response.overlapV.x * 1.2;
            this.transform.Y += response.overlapV.y * 1.2;
        }
    }

    public setInput(commands: Map<string, string> ) {
        this.inputCommands = commands;
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if(this.inputCommands.has("D")) {
            this.moveDirection = parseInt(this.inputCommands.get("D"));
            this.inputCommands.delete("D");
        }

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

        if(this.moveDirection != 0) {
            this.transform.X += xFactor * this.velocity * delta;
            this.transform.Y += yFactor * this.velocity * delta;

            this.changes.add(ChangesDict.POSITION);
        }
    }

    protected serverUpdate(delta: number) {
        if(this.inputCommands.has("C")) {
            for(let i = 0; i < 1; i++) {
                let bullet: Bullet = ObjectsFactory.CreateGameObject("B") as Bullet;
                bullet.Owner = this.ID;

                bullet.Transform.Rotation = parseFloat(this.inputCommands.get("C"));
                //bullet.Transform.Rotation = Math.floor(Math.random() * 360);

                bullet.Transform.X = this.transform.X;
                bullet.Transform.Y = this.transform.Y;
            }
            this.inputCommands.delete("C");
        }
    }

    set Direction(direction: number) {
        if(direction >= 0 && direction <= 8) {
            this.moveDirection = direction;
        }
    }

    hit(power: number) {
        this.hp -= power;
        if(this.hp < 0) {
            this.hp = 0;
        }
        this.changes.add(ChangesDict.HP);
    }

    get MaxHP(): number {
        return this.maxHp;
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

    static serializeMaxHp(player: Player): string {
        return ChangesDict.buildTag(ChangesDict.MAX_HP) + player.maxHp.toString();
    }

    static deserializeMaxHp(player: Player, data: string) {
        player.maxHp = parseInt(data);
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
        [ChangesDict.MAX_HP, Player.serializeMaxHp],
        [ChangesDict.HP, Player.serializeHp],
        [ChangesDict.NAME, Player.serializeName],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.MAX_HP, Player.deserializeMaxHp],
        [ChangesDict.HP, Player.deserializeHp],
        [ChangesDict.NAME, Player.deserializeName],
    ]);
}

