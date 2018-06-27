import {GameObject} from "../../common/utils/game/GameObject";
import {Projectile} from "../../common/utils/game/Projectile";
import {GameObjectAnimationRender} from "./GameObjectAnimationRender";

export class BulletRender extends GameObjectAnimationRender {
    private bulletReference: Projectile;

    constructor() {
        super();
    }

    public setObject(bullet: Projectile) {
        super.setObject(bullet as GameObject);
        this.bulletReference = bullet;
    }

    public update() {
        super.update();
    }

    public destroy() {
        super.destroy();
    }
}