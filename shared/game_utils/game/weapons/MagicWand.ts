import { Actor } from "../objects/Actor";
import { FireBall } from "../objects/FireBall";
import { Weapon } from "./Weapon";
import { projectileAim } from "../../../core/Aiming";
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
        const aim = projectileAim(user.Transform.Position, position, [user.Transform.ScaleX, user.Transform.ScaleY]);
        if (!aim) return;
        user.ObjectsFactory.instantiateWithPosition(
            "FireBall",
            aim.position,
            undefined,
            undefined,
            undefined,
            (object) => {
                const fireBall = object as FireBall;
                fireBall.setOwner(user);
                fireBall.Transform.Rotation = aim.rotation;
            },
        );
        this.nextShotAtMs = user.Runtime.timeMs + this.cooldownMs;
    }

    equip() {}

    hide() {}
}
