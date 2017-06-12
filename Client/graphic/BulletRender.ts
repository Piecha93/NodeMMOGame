import {GameObjectRender} from "./GameObjectRender";
import {GameObject} from "../../Common/utils/game/GameObject";
import {Bullet} from "../../Common/utils/game/Bullet";

export class BulletRender extends GameObjectRender {
    private bulletReference: Bullet;

    constructor() {
        super();
    }

    public setObject(bullet: Bullet) {
        super.setObject(bullet as GameObject);
        this.bulletReference = bullet;

        this.sprite.width = 32;
        this.sprite.height = 32;
    }

    public update() {
        super.update();
        this.sprite.rotation = this.bulletReference.DirectionAngle;
    }
}