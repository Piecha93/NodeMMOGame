import {Transform} from "../physics/Transform";
import {ObjectsFactory} from "./ObjectsFactory";
import {Bullet} from "./Bullet";
import {Actor} from "./Actor";
import {ChangesDict} from "../serialize/ChangesDict";

export class Enemy extends Actor {
    private timeFromLastShot = 1000;

    private moveAngle: number = 0;
    constructor(transform: Transform) {
        super(transform);
        this.moveAngle = Math.random() * 3;
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

    }

    protected serverUpdate(delta: number) {
        if(this.HP <= 0) {
            this.destroy();
            return;
        }

        this.timeFromLastShot -= delta;
        if(this.timeFromLastShot <= 0) {
            this.timeFromLastShot = 1000;
            for(let i = 0; i < 2; i++) {
                let bullet: Bullet = ObjectsFactory.CreateGameObject(Bullet) as Bullet;
                bullet.Owner = this.ID;

                bullet.Transform.Rotation = Math.floor(Math.random() * 360);

                bullet.Transform.X = this.transform.X;
                bullet.Transform.Y = this.transform.Y;
            }
        }

        this.moveAngle += Math.random() * 0.5 - 0.25;

        let sinAngle: number = Math.sin(this.moveAngle);
        let cosAngle: number = Math.cos(this.moveAngle);

        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;

        this.transform.addChange(ChangesDict.X);
        this.transform.addChange(ChangesDict.Y);
    }
}

