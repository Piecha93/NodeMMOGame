import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {FireBall} from "./FireBall";
import {Obstacle} from "./Obstacle";
import {SerializableProperty} from "../../../serialize/SerializeDecorators";
import {Result} from "detect-collisions";
import {Item} from "./Item";
import {Weapon} from "../weapons/Weapon";
import {SerializableTypes} from "../../../serialize/Serializable";


export abstract class Actor extends GameObject {
    @SerializableProperty(ChangesDict.NAME, SerializableTypes.String)
    private name: string;

    @SerializableProperty(ChangesDict.MAX_HP, SerializableTypes.Uint16)
    private maxHp: number;

    @SerializableProperty(ChangesDict.HP, SerializableTypes.Uint16)
    private hp: number;

    @SerializableProperty(ChangesDict.ANIMATION_TYPE, SerializableTypes.String)
    protected animationType: string;

    @SerializableProperty(ChangesDict.HORIZONTAL, SerializableTypes.Int8)
    protected horizontal: number = 0;
    @SerializableProperty(ChangesDict.VERTICAL, SerializableTypes.Int8)
    protected vertical: number = 0;

    protected weapon: Weapon = null;

    protected constructor(transform: Transform) {
        super(transform);

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;
        this.name = "";

        this.animationType = "idle";
    }

    public updatePosition(delta: number) {
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

    protected serverOnCollisionEnter(gameObject: GameObject, result: Result) {
        super.serverOnCollisionEnter(gameObject, result);
    }

    protected commonOnCollisionEnter(gameObject: GameObject, result: Result) {
        super.commonOnCollisionEnter(gameObject, result);
    }

    protected commonOnCollisionStay(gameObject: GameObject, result: Result) {
        super.commonOnCollisionStay(gameObject, result);

        if(gameObject.IsSolid) {
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

    public parseMoveDir(): [number, number] {
        let speed: number = 0;
        if(this.horizontal != 0 && this.vertical != 0) {
            speed = 0.7071;
        } else if(this.horizontal != 0 || this.vertical != 0) {
            speed = 1;
        }

        return [speed * this.vertical, speed * this.horizontal];
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

    set Horizontal(horizontal: number) {
        if(this.horizontal == horizontal) return;

        this.horizontal = horizontal;
        this.addChange(ChangesDict.HORIZONTAL);

        this.setAnimationType();
    }

    set Vertical(vertical: number) {
        if(this.vertical == vertical) return;

        this.vertical = vertical;
        this.addChange(ChangesDict.VERTICAL);

        this.setAnimationType();
    }

    private setAnimationType() {
        if(this.horizontal != 0 || this.vertical != 0) {
            this.animationType = "run";
            this.addChange(ChangesDict.ANIMATION_TYPE);
        } else {
            this.animationType = "idle";
            this.addChange(ChangesDict.ANIMATION_TYPE);
        }
    }

    get Horizontal(): number {
        return this.horizontal;
    }

    get Vertical(): number {
        return this.vertical;
    }

    get SpriteName(): string {
        return this.spriteName + "_" + this.animationType;
    }

    set SpriteName(spriteName: string) {
        this.spriteName = spriteName;
        this.addChange(ChangesDict.SPRITE_ID);
    }

    set Weapon(weapon: Weapon) {
        this.weapon = weapon;
    }
}

