import {Transform} from "../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../serialize/ChangesDict";
import {MagicWand} from "./MagicWand";

export class Enemy extends Actor {
    private timeSinceLastShot = 1000;

    constructor(transform: Transform) {
        super(transform);
        this.velocity = 0.3;

        // this.spriteName = "michau";

        this.weapon = new MagicWand();
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
            for(let i = 0; i < 1; i++) {
                this.weapon.use(this, Math.random() * 360, 0);
                this.MoveDirection = Math.round(Math.random() * 8);
            }
        }

        this.updatePosition(delta);

        this.transform.addChange(ChangesDict.X);
        this.transform.addChange(ChangesDict.Y);
    }
}

