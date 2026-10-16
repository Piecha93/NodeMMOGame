import { Actor } from "../objects/Actor";
import { FireBall } from "../objects/FireBall";
import { Weapon } from "./Weapon";
import { calcAngle } from "../../../utils/functions/CalcAngle";
import { MouseKeys } from "../../../input/InputCommands";

export class MagicWand implements Weapon {
    private nextShotAtMs = -Infinity;

    constructor(private readonly cooldownMs = 240) {
        if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) throw new RangeError("Invalid wand cooldown");
    }

    public use(user: Actor, position: [number, number], clickButton: number) {
        if (
            user.Runtime.isClient ||
            user.IsDestroyed ||
            user.HP <= 0 ||
            clickButton !== MouseKeys.LEFT ||
            !position.every(Number.isFinite) ||
            user.Runtime.timeMs < this.nextShotAtMs
        )
            return;
        let angle: number = calcAngle(position, user.Transform.Position);

        let fireBall: FireBall = user.ObjectsFactory.instantiateWithPosition("FireBall", [
            user.Transform.X,
            user.Transform.Y,
        ]) as FireBall;

        fireBall.setOwner(user);
        fireBall.Transform.Rotation = angle;
        this.nextShotAtMs = user.Runtime.timeMs + this.cooldownMs;
    }

    equip() {}

    hide() {}
}
