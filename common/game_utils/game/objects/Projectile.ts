import {GameObject} from "./GameObject";
import {Result} from "detect-collisions";

export class Projectile extends GameObject {
    protected lifeSpan: number = 50;

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

        // lifeSpan == 0 -> infinite
        if(this.lifeSpan != 0) {
            if (this.lifeSpan > delta) {
                this.lifeSpan -= delta;
            } else {
                this.destroy();
            }
        }
    }
}