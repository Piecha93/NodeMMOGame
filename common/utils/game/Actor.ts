import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {FireBall} from "./FireBall";
import {Obstacle} from "./Obstacle";
import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {Result} from "detect-collisions";
import {Item} from "./Item";
import {Weapon} from "./Weapon";
import {SerializableTypes} from "../../serialize/Serializable";

export abstract class Actor extends GameObject {
    @NetworkProperty(ChangesDict.NAME, SerializableTypes.string)
    private name: string;
    @NetworkProperty(ChangesDict.MAX_HP, SerializableTypes.Uint16)
    private maxHp: number;
    @NetworkProperty(ChangesDict.HP, SerializableTypes.Uint16)
    private hp: number;

    protected moveDirection: number = 0;

    protected faceDirection: number = 5;

    protected weapon: Weapon = null;

    protected constructor(transform: Transform) {
        super(transform);

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;
        this.name = "";

        this.transform.Width = 40;
        this.transform.Height = 64;

        this.spriteName = "template";
    }

    protected updatePosition(delta: number) {
        let moveFactors: [number, number] = this.parseMoveDir();
        if (moveFactors[0] != 0) {
            this.Transform.X += moveFactors[0] * this.velocity * delta;
            this.Transform.addChange(ChangesDict.X);
        }
        if (moveFactors[1] != 0) {
            this.Transform.Y += moveFactors[1] * this.velocity * delta;
            this.Transform.addChange(ChangesDict.Y);
        }
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
        super.serverCollision(gameObject, result);
        if(gameObject instanceof FireBall) {
            let bullet: FireBall = gameObject as FireBall ;
            if (bullet.Owner == this.ID) {
                return;
            }
            this.hit(bullet.Power);
        } else if(gameObject instanceof Item) {
            let item: Item = gameObject as Item;
            if(item.Claim()) {
                this.heal(50);
            }
        }
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        super.commonCollision(gameObject, result);

        if(gameObject instanceof Obstacle) {
            this.Transform.X -= result.overlap * result.overlap_x;
            this.Transform.Y -= result.overlap * result.overlap_y;
        }
    }

    hit(power: number) {
        this.hp -= power;
        if(this.hp < 0) {
            this.hp = 0;
        }
        this.addChange(ChangesDict.HP);
    }

    heal(power: number) {
        this.hp += power;
        if(this.hp > this.maxHp) {
            this.hp = this.maxHp;
        }
        this.addChange(ChangesDict.HP);
    }

    private static cornerDir: number = 0.7071;

    private static moveDirsX = [0, 0, Actor.cornerDir, 1, Actor.cornerDir, 0, -Actor.cornerDir, -1, -Actor.cornerDir];
    private static moveDirsY = [0, -1, -Actor.cornerDir, 0, Actor.cornerDir, 1, Actor.cornerDir, 0, -Actor.cornerDir];

    protected parseMoveDir(): [number, number] {
        return [Actor.moveDirsX[this.moveDirection], Actor.moveDirsY[this.moveDirection]]
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
        this.addChange(ChangesDict.NAME);
    }

    set MoveDirection(direction: number) {
        if(direction >= 0 && direction <= 8) {
            this.moveDirection = direction;
            if(direction != 0) {
                this.faceDirection = direction;
            }
        }
    }

    get SpriteName(): string {
        if(this.moveDirection == 0) {
            return this.spriteName + "_idle";
        } else {
            return this.spriteName + "_run";
        }
    }

    get MoveDirection(): number {
        return this.moveDirection;
    }

    get FaceDirection(): number {
        return this.faceDirection;
    }
}

