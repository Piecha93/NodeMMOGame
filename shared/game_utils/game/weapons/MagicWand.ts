import {Actor} from "../objects/Actor";
import {FireBall} from "../objects/FireBall";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../../factory/ObjectsFactory";
import {calcAngle} from "../../../utils/functions/CalcAngle";

export class MagicWand implements Weapon {
    public use(user: Actor, position: [number, number], clickButton: number) {

        let angle: number = calcAngle(position, user.Transform.Position);

        let fireBall: FireBall = GameObjectsFactory.InstatiateWithPosition("FireBall", [user.Transform.X, user.Transform.Y]) as FireBall;

        fireBall.Owner = user.ID;
        fireBall.Transform.Rotation = angle;
    };

    equip() {
    }

    hide() {
    }
}