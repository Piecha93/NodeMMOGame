import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {Result} from "detect-collisions";

export class Obstacle extends GameObject {

    constructor(transform: Transform) {
        super(transform);

        transform.Height = 32;
        transform.Width = 32;

        this.SpriteName = "wall";
    }

    onCollisionEnter(gameObject: GameObject, result: Result) {
        throw "This method should never be called on Obstacle object";
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
        throw "This method should never be called on Obstacle object";
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        throw "This method should never be called on Obstacle object";
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);


    }
}