import {Actor} from "../objects/Actor";
import {FireBall} from "../objects/FireBall";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../../factory/ObjectsFactory";
import {Transform} from "../../physics/Transform";
import {calcAngle} from "../../../utils/functions/CalcAngle";

export class MagicWand implements Weapon {
    public use(user: Actor, position: [number, number], clickButton: number) {

        let angle: number = calcAngle(position, [user.Transform.X, user.Transform.Y]);

        let transform = new Transform(user.Transform.X, user.Transform.Y, 20);
        transform.Rotation = angle;

        let fireBall: FireBall = GameObjectsFactory.InstatiateWithTransform("FireBall", transform) as FireBall;
        fireBall.Owner = user.ID;
    };

    equip() {
    }

    hide() {
    }
}