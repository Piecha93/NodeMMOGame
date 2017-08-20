import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";

export class Obstacle extends GameObject {

    //private lifeSpan: number = -1;

    constructor(transform: Transform) {
        super(transform);
    }

    onCollisionEnter(gameObject: GameObject) {

    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        //this.changes.add(ChangesDict.POSITION);
    }
}