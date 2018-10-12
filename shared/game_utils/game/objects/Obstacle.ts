import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {Player} from "./Player";

export class Obstacle extends GameObject {

    constructor(transform: Transform) {
        super(transform);

        this.isCollisionStatic = true;
    }

    // onCollisionEnter(gameObject: GameObject, result: Result) {
        // throw "This method should never be called on Obstacle object";
    // }

    protected serverCollision(gameObject: GameObject, result: Result) {
        if(gameObject instanceof Player || gameObject instanceof Obstacle) {
            this.Transform.X -= result.overlap * result.overlap_x;
            this.Transform.Y -= result.overlap * result.overlap_y;
        }
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        // throw "This method should never be called on Obstacle object";
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

    }
}