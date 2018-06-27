import {Projectile} from "./Projectile";
import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Obstacle} from "./Obstacle";
import {Actor} from "./Actor";
import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {Result} from "detect-collisions";

export class FireBall extends Projectile {
    @NetworkProperty(ChangesDict.POWER, "Uint16")
    private power: number = 10;
    @NetworkProperty(ChangesDict.OWNER, "string")
    private owner: string;

    constructor(transform: Transform) {
        super(transform);

        this.spriteName = "flame";

        this.velocity = 1;

        this.transform.Width = 30;

        this.lifeSpan = 5000;
        this.addChange(ChangesDict.VELOCITY);
    }

    public deserialize(updateBufferView: DataView, offset: number) {
        this.printSerializeOrder();
        let arr = "";
        console.log("asd");
        for(let i = offset; i < updateBufferView.byteLength; i++) {
            arr += updateBufferView.getUint8(i) + ", ";
        }
        console.log(arr);
        console.log("deserialize " + [this.transform.X, this.transform.Y, this.transform.Rotation, this.velocity]);
        let dupa = super.deserialize(updateBufferView, offset);
        console.log("deserialize2 " + [this.transform.X, this.transform.Y, this.transform.Rotation, this.velocity]);

        return dupa;
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
        super.serverCollision(gameObject, result);
        if(gameObject instanceof FireBall) {
            if((gameObject as FireBall).owner != this.owner) {
                this.destroy();
            }
        } else if(gameObject instanceof Actor) {
            if(gameObject.ID != this.owner) {
                this.destroy()
            }
        } else if(gameObject instanceof Obstacle) {
            this.destroy();
        }
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        super.commonCollision(gameObject, result);
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

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        let sinAngle: number = Math.sin(this.transform.Rotation);
        let cosAngle: number = Math.cos(this.transform.Rotation);

        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;

        // console.log("updateeee " + [this.transform.X, this.transform.Y]);
        // console.log("vel " + this.velocity);
    }
}