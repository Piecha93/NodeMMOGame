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



    }

    public render() {
        super.render();
            this.sprite.angle = this.bulletReference.DirectionAngle;
    }
}