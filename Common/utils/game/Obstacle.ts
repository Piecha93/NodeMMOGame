import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {Body, Box} from "p2";
import {ChangesDict} from "../../serialize/ChangesDict";

export class Obstacle extends GameObject {

    //private lifeSpan: number = -1;

    constructor(transform?: Transform) {
        super(transform);

        if(!transform) {
            let body: Body = new Body({
                mass: 0
            });
            body.addShape(new Box({
                width: 32,
                height: 32
            }));
            this.transform = new Transform(body);
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