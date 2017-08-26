import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Obstacle} from "./Obstacle";
import {Actor} from "./Actor";
import {NetworkProperty} from "../../serialize/NetworkDecorators";

export class Bullet extends GameObject {
    private lifeSpan: number = 50;
    @NetworkProperty(ChangesDict.POWER)
    private power: number = 10;
    @NetworkProperty(ChangesDict.OWNER)
    private owner: string;

    constructor(transform: Transform) {
        super(transform);

        if(Math.floor(Math.random() * 2)) {
            this.spriteName = "bluebolt";
            this.velocity = 1.4;
        } else {
            this.spriteName = "fireball";
            this.velocity = 0.7;
        }

        this.spriteName = "flame";
        this.velocity = 0.7;

        this.transform.Width = 30;
        this.transform.Height = 20;

        this.lifeSpan = 5000;
        this.changes.add(ChangesDict.VELOCITY);
    }

    protected serverCollision(gameObject: GameObject, response: SAT.Response) {
        super.serverCollision(gameObject, response);
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

    protected commonCollision(gameObject: GameObject, response: SAT.Response) {
        super.commonCollision(gameObject, response);
        if(gameObject instanceof Obstacle) {
            if(response.overlapN.x) {
                this.Transform.Rotation = Math.PI - this.Transform.Rotation;
            } else {
                this.Transform.Rotation = 2*Math.PI - this.Transform.Rotation;
            }

            this.changes.add(ChangesDict.ROTATION);
            if(response.overlapV.x != 0) {
                this.transform.X += response.overlapV.x * 1.2;
                this.transform.addChange(ChangesDict.X);
            }
            if(response.overlapV.y != 0) {
                this.transform.Y += response.overlapV.y * 1.2;
                this.transform.addChange(ChangesDict.Y);
            }
        }
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

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

        this.lifeSpan -= delta;

        if(this.lifeSpan <= 0) {
            this.destroy();
        }
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        let sinAngle: number = Math.sin(this.transform.Rotation);
        let cosAngle: number = Math.cos(this.transform.Rotation);

        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;
    }
}