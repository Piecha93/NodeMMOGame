import {Transform} from "../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../serialize/ChangesDict";

export class Enemy extends Actor {
    private timeSinceLastShot = 1000;

    private moveAngle: number = 0;
    constructor(transform: Transform) {
        super(transform);
        this.moveAngle = Math.random() * 3;
        this.velocity = 0.5
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

    }

    protected serverUpdate(delta: number) {
        if(this.HP <= 0) {
            this.destroy();
            return;
        }

        this.timeSinceLastShot -= delta;
        if(this.timeSinceLastShot <= 0) {
            this.timeSinceLastShot = 1000;
            for(let i = 0; i < 2; i++) {
                // this.shot(Math.floor(Math.random() * 360));
            }
        }

        this.moveAngle += Math.random() * 0.5 - 0.25;

        let sinAngle: number = Math.sin(this.moveAngle);
        let cosAngle: number = Math.cos(this.moveAngle);

        // this.transform.X += cosAngle * this.velocity * delta;
        // this.transform.Y += sinAngle * this.velocity * delta;

        // this.transform.addChange(ChangesDict.X);
        // this.transform.addChange(ChangesDict.Y);
    }
}

