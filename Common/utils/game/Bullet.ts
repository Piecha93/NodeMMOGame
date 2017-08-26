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
        this.velocity = 0;

        this.transform.Width = 30;
        this.transform.Height = 20;

        this.lifeSpan = 5000;
        this.addChange(ChangesDict.VELOCITY);
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
                // this.Transform.Rotation = Math.PI - this.Transform.Rotation;
            } else {
                // this.Transform.Rotation = 2*Math.PI - this.Transform.Rotation;
            }

            if(response.overlapV.x != 0) {
                this.velocityx *= -0.75;
                this.transform.X += response.overlapV.x * 1.2;
                this.transform.addChange(ChangesDict.Y);
                this.Transform.addChange("xx");
            }
            if(response.overlapV.y != 0) {
                this.velocity *= -0.75;
                this.transform.Y += response.overlapV.y * 1.2;
                this.transform.addChange(ChangesDict.Y);
                this.Transform.addChange(ChangesDict.VELOCITY);
            }
        }
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

        this.lifeSpan -= delta;

        if(this.lifeSpan <= 0) {
            this.destroy();
        }
    }
    private acceleration = 0.005;

    @NetworkProperty('xx')
    velocityx = null;
    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        // let sinAngle: number = Math.sin(this.Transform.Rotation);
        // let cosAngle: number = Math.cos(this.Transform.Rotation);

        if(!this.velocityx) {
            this.velocityx = Math.cos(this.Transform.Rotation);
            this.velocity += Math.sin(this.Transform.Rotation);
        }
        
        this.velocity += delta * (this.acceleration) / 2;
        this.transform.X += this.velocityx * delta;
        this.transform.Y += this.velocity * delta;

        this.Transform.Rotation = Math.atan2(this.velocity, this.velocityx);

        this.Transform.addChange(ChangesDict.Y);
        this.Transform.addChange(ChangesDict.VELOCITY);
        this.Transform.addChange("xx");
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