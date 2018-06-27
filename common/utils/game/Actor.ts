import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {FireBall} from "./FireBall";
import {Obstacle} from "./Obstacle";
import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {Result} from "detect-collisions";
import {Item} from "./Item";
import {Weapon} from "./Weapon";

export abstract class Actor extends GameObject {
    @NetworkProperty(ChangesDict.NAME, "string")
    private name: string;
    @NetworkProperty(ChangesDict.MAX_HP, "Uint16")
    private maxHp: number;
    @NetworkProperty(ChangesDict.HP, "Uint16")
    private hp: number;

    protected weapon: Weapon = null;

    constructor(transform: Transform) {
        super(transform);

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;
        this.name = "";

        this.transform.Width = 40;
        this.transform.Height = 64;

        this.spriteName = "bunny";
    }

    protected shot(angle: number) {
        this.weapon.use(this, angle)
        // let bulletPosition = new Transform(this.Transform.X, this.Transform.Y, 1);
        // bulletPosition.Rotation = angle;
        // let bullet: Bullet = GameObjectsFactory.Instatiate("Bullet") as Bullet;
        // let bullet: Bullet = GameObjectsFactory.InstatiateWithTransform("Bullet", bulletPosition) as Bullet;
        // bullet.Owner = this.ID;
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
}

