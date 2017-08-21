import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {ChangesDict} from "./ChangesDict";
import {Bullet} from "./Bullet";
import {Obstacle} from "./Obstacle";
import {NetworkProperty} from "./NetworkPropertyDecorator";


export abstract class Actor extends GameObject {
    @NetworkProperty
    private name: string;
    @NetworkProperty
    private maxHp: number;
    @NetworkProperty
    private hp: number;

    constructor(transform: Transform) {
        super(transform);

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;
        this.name = '';

        this.transform.Width = 40;
        this.transform.Height = 64;

        this.spriteName = "bunny";
    }

    protected serverCollision(gameObject: GameObject, response: SAT.Response) {
        super.serverCollision(gameObject, response);
        if(gameObject instanceof Bullet) {
            let bullet: Bullet = gameObject as Bullet;
            if(bullet.Owner == this.ID) {
                return;
            }
            this.hit(bullet.Power);
        }
    }

    protected commonCollision(gameObject: GameObject, response: SAT.Response) {
        super.commonCollision(gameObject, response);
        if(gameObject instanceof Obstacle) {
            this.transform.X += response.overlapV.x * 1.2;
            this.transform.Y += response.overlapV.y * 1.2;
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
        this.changes.add(ChangesDict.NAME);
    }
}

