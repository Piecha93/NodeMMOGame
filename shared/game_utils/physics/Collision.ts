import {Collider} from "./Collider";
import {Result} from "detect-collisions";


export class Collision {
    private colliderA: Collider;
    private colliderB: Collider;

    private result: Result;

    constructor(colliderA: Collider, colliderB: Collider, result: Result) {
        this.colliderA = colliderA;
        this.colliderB = colliderB;

        this.result = result;
    }

    get ColliderA(): Collider {
        return this.colliderA;
    }

    get ColliderB(): Collider {
        return this.colliderB;
    }

    get Result(): Result {
        return this.result;
    }
}