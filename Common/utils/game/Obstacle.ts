import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {GameObjectType} from "./GameObjectTypes";

export class Obstacle extends GameObject {
    get Type(): string {
        return GameObjectType.Obstacle.toString();
    }

    //private lifeSpan: number = -1;

    constructor(transform: Transform) {
        super(transform);
        this.id = this.Type + this.id;
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