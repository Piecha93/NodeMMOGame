import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";

export class Obstacle extends GameObject {

    //private lifeSpan: number = -1;

    constructor(transform: Transform) {
        super(transform);

        transform.Height = 48;
        transform.Width = 48;

        this.SpriteName = "wall";
    }

    onCollisionEnter(gameObject: GameObject) {

    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        //this.addChange(ChangesDict.POSITION);
    }
}