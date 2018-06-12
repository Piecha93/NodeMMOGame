import {GameObject} from "../../common/utils/game/GameObject";
import {Bullet} from "../../common/utils/game/Bullet";
import {GameObjectAnimationRender} from "./GameObjectAnimationRender";

export class BulletRender extends GameObjectAnimationRender {
    private bulletReference: Bullet;

    constructor() {
        super();
    }

    public setObject(bullet: Bullet) {
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