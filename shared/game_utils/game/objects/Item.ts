import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {Actor} from "./Actor";

export class Item extends GameObject {
    constructor(transform: Transform) {
        super(transform);
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
        super.serverCollision(gameObject, result);

        if(gameObject instanceof Actor) {
            gameObject.heal(50)
        }
        this.destroy();
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        super.commonCollision(gameObject, result);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }
}