import {Transform} from "../physics/Transform";
import {GameObjectType} from "./GameObjectTypes";
import {ObjectsFactory} from "./ObjectsFactory";
import {Bullet} from "./Bullet";
import {Actor} from "./Actor";
import {ChangesDict} from "./ChangesDict";

export class Enemy extends Actor {
    private timeFromLastShot = 1000;

    get Type(): string {
        return GameObjectType.Player.toString();
    }

    constructor(name: string, transform: Transform) {
        super(name, transform);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        let rotation: number = Math.random() * 10;

        let sinAngle: number = Math.sin(rotation);
        let cosAngle: number = Math.cos(rotation);

        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;

        this.changes.add(ChangesDict.POSITION);
    }

    protected serverUpdate(delta: number) {
        if(this.HP <= 0) {
            this.destroy();
            return;
        }

        this.timeFromLastShot -= delta;
        if(this.timeFromLastShot <= 0) {
            this.timeFromLastShot = 1000;
            for(let i = 0; i < 10; i++) {
                let bullet: Bullet = ObjectsFactory.CreateGameObject("B") as Bullet;
                bullet.Owner = this.ID;

                bullet.Transform.Rotation = Math.floor(Math.random() * 360);

                bullet.Transform.X = this.transform.X;
                bullet.Transform.Y = this.transform.Y;
            }
        }
    }
}

