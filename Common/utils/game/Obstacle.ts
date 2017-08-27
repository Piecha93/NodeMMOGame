import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {Body} from "p2";
import {ChangesDict} from "../../serialize/ChangesDict";

export class Obstacle extends GameObject {

    //private lifeSpan: number = -1;

    constructor(transform?: Transform) {
        super(transform);

        if(!transform) {
            this.transform = this.transform = new Transform(new Body({
                mass: 0
            }));
        }
        // transform.Height = 48;
        // transform.Width = 48;

        this.SpriteName = "wall";
    }

    onCollisionEnter(gameObject: GameObject) {

    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
        // this.Transform.addChange(ChangesDict.X);
        // this.Transform.addChange(ChangesDict.Y);
        // this.Transform.addChange(ChangesDict.ROTATION);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        //this.addChange(ChangesDict.POSITION);
    }
}