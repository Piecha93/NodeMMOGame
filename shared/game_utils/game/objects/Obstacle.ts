import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";

export class Obstacle extends GameObject {

    constructor(transform: Transform) {
        super(transform);

        this.isCollisionStatic = true;
        this.isSolid = true;
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

    }
}