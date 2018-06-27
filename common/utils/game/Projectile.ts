import {GameObject} from "./GameObject";
import {Result} from "detect-collisions";

import {NetworkProperty} from "../../serialize/NetworkDecorators";

export class Projectile extends GameObject {
    @NetworkProperty("DEL", "Uint16")
    protected lifeSpan: number = 50;

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

        this.lifeSpan -= delta;

        if(this.lifeSpan <= 0) {
            this.destroy();
        }
    }
}