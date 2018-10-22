import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {SerializableProperty} from "../../../serialize/SerializeDecorators";
import {Obstacle} from "./Obstacle";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {Actor} from "./Actor";
import {SerializableTypes} from "../../../serialize/Serializable";

export class Portal extends GameObject {
    private couplingPortal: Portal = null;

    @SerializableProperty(ChangesDict.IS_ATTACHED, SerializableTypes.Int8)
    private isAttached: boolean = false;

    constructor(transform: Transform) {
        super(transform);

        this.velocity = 2;
    }

    get IsActive(): boolean {
        if(this.couplingPortal == null) {
            return false;
        }

        if(this.couplingPortal.IsDestroyed != false) {
            this.couplingPortal = null;
            return false;
        }

        return this.isAttached && this.couplingPortal.isAttached;
    }

    protected serverOnCollisionEnter(gameObject: GameObject, result: Result) {
        if(gameObject instanceof Portal) {
            this.destroy();
            return;
        } else if(gameObject.IsSolid) {
            this.isAttached = true;

            this.Transform.X -= result.overlap * result.overlap_x;
            this.Transform.Y -= result.overlap * result.overlap_y;

            this.transform.Rotation = gameObject.Transform.Rotation;

            this.addChange(ChangesDict.IS_ATTACHED);
            this.Transform.addChange(ChangesDict.X);
            this.Transform.addChange(ChangesDict.Y);
        }
        if(this.IsActive) {
            if(gameObject instanceof Actor) {
                gameObject.Transform.X = this.couplingPortal.Transform.X;
                gameObject.Transform.Y = this.couplingPortal.Transform.Y;
                gameObject.Transform.addChange(ChangesDict.X);
                gameObject.Transform.addChange(ChangesDict.Y);

                this.couplingPortal.destroy();
                this.destroy();
            }
        }
        super.serverOnCollisionEnter(gameObject, result);
    }

    protected commonOnCollisionEnter(gameObject: GameObject, result: Result) {
        super.commonOnCollisionEnter(gameObject, result);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        if(!this.isAttached) {
            let sinAngle: number = Math.sin(this.transform.Rotation);
            let cosAngle: number = Math.cos(this.transform.Rotation);

            this.transform.X += cosAngle * this.velocity * delta;
            this.transform.Y += sinAngle * this.velocity * delta;
        }

        super.commonUpdate(delta);
    }

    set CouplingPortal(portal: Portal) {
        this.couplingPortal = portal;
    }
}