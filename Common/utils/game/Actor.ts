import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Bullet} from "./Bullet";
import {Obstacle} from "./Obstacle";
import {ObjectsFactory} from "./ObjectsFactory";
import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {Body} from "p2";

export abstract class Actor extends GameObject {
    @NetworkProperty(ChangesDict.NAME)
    private name: string;
    @NetworkProperty(ChangesDict.MAX_HP)
    private maxHp: number;
    @NetworkProperty(ChangesDict.HP)
    private hp: number;

    constructor(transform: Transform) {
        super(transform);

        if(!transform) {
            //{isStatic: true}
            this.transform = new Transform(new Body({
                mass: 5
            }));
        }
        this.transform.ScaleY = 2;
        this.Transform.Body.fixedRotation = 1;

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.name = '';

        // this.transform.Width = 40;
        // this.transform.Height = 64;

        this.spriteName = "bunny";
    }

    protected shot(angle: number) {
        let bullet: Bullet = ObjectsFactory.Instatiate("Bullet") as Bullet;
        bullet.Owner = this.ID;

        bullet.Transform.Rotation = angle;
        bullet.Transform.X = this.transform.X + Math.random() * 100 - 50;
        bullet.Transform.Y = this.transform.Y+ Math.random() * 100 - 50;

        let sinAngle: number = Math.sin(this.Transform.Rotation);
        let cosAngle: number = Math.cos(this.Transform.Rotation);

        this.Transform.Body.applyForce([cosAngle * 2, sinAngle * 2]);
        // Body.applyForce(bullet.Transform.Body, this.Transform.Body.position, Vector.create(cosAngle * 2, sinAngle * 2));
        // Body.setVelocity(bullet.Transform.Body, Vector.create(cosAngle * 10, sinAngle * 10));
        // bullet.Transform.Body.force.x = cosAngle * 2;
        // bullet.Transform.Body.force.y = sinAngle * 2;
    }

    protected serverCollision(gameObject: GameObject) {
        super.serverCollision(gameObject);
        if(gameObject instanceof Bullet) {
            let bullet: Bullet = gameObject as Bullet;
            if(bullet.Owner == this.ID) {
                return;
            }
            this.hit(bullet.Power);
        }
    }

    protected commonCollision(gameObject: GameObject) {
        super.commonCollision(gameObject);

        if(gameObject instanceof Obstacle) {
            // this.transform.X += response.overlapV.x * 1.2;
            // this.transform.Y += response.overlapV.y * 1.2;
        }
    }

    hit(power: number) {
        this.hp -= power;
        if(this.hp < 0) {
            this.hp = 0;
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

