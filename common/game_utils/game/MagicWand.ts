import {Actor} from "./Actor";
import {FireBall} from "./FireBall";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../factory/ObjectsFactory";
import {Transform} from "../physics/Transform";

export class MagicWand implements Weapon {
    public use(user: Actor, angle: number, clickButton: number) {
        let position = new Transform(user.Transform.X, user.Transform.Y, 20);
        position.Rotation = angle;

        let fireBall: FireBall = GameObjectsFactory.InstatiateWithTransform("FireBall", position) as FireBall;
        fireBall.Owner = user.ID;
    };

    equip() {
    }

    hide() {
    }
}