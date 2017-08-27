import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Obstacle} from "./Obstacle";
import {Actor} from "./Actor";
import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {Body} from "p2";

export class Bullet extends GameObject {
    private lifeSpan: number = 50;
    @NetworkProperty(ChangesDict.POWER)
    private power: number = 10;
    @NetworkProperty(ChangesDict.OWNER)
    private owner: string;

    constructor(transform?: Transform) {
        super(transform);

        if(!transform) {
            this.transform = this.transform = new Transform(new Body({
                mass: 5
            }));
        }

        this.spriteName = "flame";

        this.lifeSpan = 5000;
        this.addChange(ChangesDict.VELOCITY);
    }
    protected serverCollision(gameObject: GameObject) {
        super.serverCollision(gameObject);
        if(gameObject instanceof Bullet) {
            if((gameObject as Bullet).owner != this.owner) {
                this.destroy();
            }
       }
       if(gameObject instanceof Actor) {
            if(gameObject.ID != this.owner) {
                this.destroy()
            }
        }
    }

    protected commonCollision(gameObject: GameObject) {
        super.commonCollision(gameObject);

    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

        this.lifeSpan -= delta;

        if(this.lifeSpan <= 0) {
            this.destroy();
        }
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        // let sinAngle: number = Math.sin(this.Transform.Rotation);
        // let cosAngle: number = Math.cos(this.Transform.Rotation);

        // if(!this.velocityx) {
        //     this.velocityx = Math.cos(this.Transform.Rotation);
        //     this.velocity += Math.sin(this.Transform.Rotation);
        // }
        
        // this.velocity += delta * (this.acceleration) / 2;
        // this.transform.X += this.velocityx * delta;
        // this.transform.Y += this.velocity * delta;

        let velocity = this.Transform.Body.velocity;
        // this.Transform.Rotation = Math.atan2(velocity[0], velocity[1]);

        this.Transform.addChange(ChangesDict.X);
        this.Transform.addChange(ChangesDict.Y);
        this.Transform.addChange(ChangesDict.ROTATION);
    }

    get Power(): number {
        return this.power;
    }

    get Owner(): string {
        return this.owner;
    }

    set Owner(value: string) {
        this.owner = value;
    }
}