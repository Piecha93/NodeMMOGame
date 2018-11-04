import {Projectile} from "./Projectile";
import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {Actor} from "./Actor";
import {SerializableProperty} from "../../../serialize/SerializeDecorators";
import {Result} from "detect-collisions";
import {SerializableTypes} from "../../../serialize/Serializable";
import {Collision} from "../../physics/Collision";

export class FireBall extends Projectile {
    @SerializableProperty(ChangesDict.POWER, SerializableTypes.Uint16)
    private power: number = 25;
    @SerializableProperty(ChangesDict.OWNER, SerializableTypes.String)
    private owner: string;

    constructor(transform: Transform) {
        super(transform);
        this.velocity = 1;

        this.lifeSpan = 2000;
        this.addChange(ChangesDict.VELOCITY);
    }

    protected serverOnCollisionEnter(collision: Collision) {
        super.serverOnCollisionEnter(collision);

        let gameObject: GameObject = collision.ColliderB.Parent;
        if(gameObject instanceof FireBall) {
            if(gameObject.owner != this.owner) {
                this.destroy();
            }
        } else if(gameObject instanceof Actor) {
            if(gameObject.ID != this.owner) {
                gameObject.hit(this.power);
                this.destroy()
            }
        } else if(gameObject.IsSolid) {
            this.destroy();
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