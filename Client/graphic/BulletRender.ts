import {GameObject} from "../../Common/utils/game/GameObject";
import {Bullet} from "../../Common/utils/game/Bullet";
import {GameObjectAnimationRender} from "../../Client/graphic/GameObjectAnimationRender";

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