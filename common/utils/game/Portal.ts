import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {Result} from "detect-collisions";
import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {Obstacle} from "./Obstacle";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Actor} from "./Actor";

export class Portal extends GameObject {
    private couplingPortal: Portal = null;

    @NetworkProperty(ChangesDict.IS_ATTACHED, "Int8")
    private isAttached: boolean = false;

    constructor(transform: Transform) {
        super(transform);

        this.velocity = 2;
        // this.spriteName = "hp_potion";
    }

    get IsActive(): boolean {
        return this.isAttached && this.couplingPortal != null;
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
        if(this.IsActive) {
            if(gameObject instanceof Actor) {
                console.log(gameObject.ID + " entered portal!");
                gameObject.Transform.X = this.couplingPortal.Transform.X;
                gameObject.Transform.Y = this.couplingPortal.Transform.Y;
                gameObject.Transform.addChange(ChangesDict.X);
                gameObject.Transform.addChange(ChangesDict.Y);

                this.couplingPortal.destroy();
                this.destroy();
            }
        } else {
            if(gameObject instanceof Obstacle) {
                this.isAttached = true;
                this.addChange(ChangesDict.IS_ATTACHED);
                this.Transform.addChange(ChangesDict.X);
                this.Transform.addChange(ChangesDict.Y);
            }
        }
        super.serverCollision(gameObject, result);
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        super.commonCollision(gameObject, result);
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