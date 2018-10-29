import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {Actor} from "./Actor";

export class Item extends GameObject {
    constructor(transform: Transform) {
        super(transform);
    }

    protected serverOnCollisionEnter(gameObject: GameObject, result: Result) {
        super.serverOnCollisionEnter(gameObject, result);

        if(gameObject instanceof Actor) {
            gameObject.heal(50)
        }
        this.destroy();
    }

    protected sharedOnCollisionEnter(gameObject: GameObject, result: Result) {
        super.sharedOnCollisionEnter(gameObject, result);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }
}