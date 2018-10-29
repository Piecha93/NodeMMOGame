import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";

export class Obstacle extends GameObject {

    constructor(transform: Transform) {
        super(transform);

        this.isCollisionStatic = true;
        this.isSolid = true;
        this.isChunkDeactivationPersistent = true;
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }
}