import { Actor } from "../objects/Actor";
import { FireBall } from "../objects/FireBall";
import { Weapon } from "./Weapon";
import { projectileAim } from "../../../core/Aiming";
import { AdventureBuild, WeaponId } from "../../../gameplay/Adventure";
import { MouseKeys } from "../../../input/InputCommands";

const SHOTS: Readonly<
    Record<
        WeaponId,
        {
            damage: number;
            cooldown: number;
            speed: number;
            lifetime: number;
            hits: number;
            spread: readonly number[];
            sprite: string;
            size: readonly [number, number];
        }
    >
> = {
    ember: {
        damage: 25,
        cooldown: 180,
        speed: 1.15,
        lifetime: 1200,
        hits: 1,
        spread: [0],
        sprite: "flame",
        size: [20, 8],
    },
    scatter: {
        damage: 22,
        cooldown: 460,
        speed: 0.9,
        lifetime: 600,
        hits: 1,
        spread: [-0.19, 0, 0.19],
        sprite: "fireball",
        size: [16, 8],
    },
    lance: {
        damage: 60,
        cooldown: 650,
        speed: 1.6,
        lifetime: 1000,
        hits: 3,
        spread: [0],
        sprite: "bluebolt",
        size: [26, 8],
    },
};

/** One cooldown owner survives weapon changes, so switching cannot bypass fire cadence. */
export class AdventureWeapon implements Weapon {
    private nextShotAtMs = -Infinity;
    private nextBurstAtMs = -Infinity;

    constructor(private readonly build: () => AdventureBuild) {}

    use(user: Actor, position: [number, number], clickButton: number): void {
        if (user.Runtime.isClient || user.IsDestroyed || user.HP <= 0 || !position.every(Number.isFinite)) return;
        const build = this.build();
        if (clickButton === MouseKeys.RIGHT) {
            if (user.Runtime.timeMs < this.nextBurstAtMs) return;
            for (let index = 0; index < 12; index++)
                this.shoot(
                    user,
                    user.Transform.Position,
                    (index * Math.PI * 2) / 12,
                    28 * build.damageMultiplier,
                    0.75,
                    240,
                    1,
                    "bluebolt",
                );
            this.nextBurstAtMs = user.Runtime.timeMs + 3000;
            return;
        }
        if (clickButton !== MouseKeys.LEFT || user.Runtime.timeMs < this.nextShotAtMs) return;
        const aim = projectileAim(user.Transform.Position, position, [user.Transform.ScaleX, user.Transform.ScaleY]);
        if (!aim) return;
        const shot = SHOTS[build.weapon];
        for (const spread of shot.spread)
            this.shoot(
                user,
                build.weapon === "lance" ? user.Transform.Position : aim.position,
                aim.rotation + spread,
                shot.damage * build.damageMultiplier,
                shot.speed,
                shot.lifetime,
                shot.hits,
                shot.sprite,
                shot.size,
            );
        this.nextShotAtMs = user.Runtime.timeMs + shot.cooldown * build.cooldownMultiplier;
    }

    private shoot(
        user: Actor,
        position: [number, number],
        rotation: number,
        damage: number,
        speed: number,
        lifetime: number,
        hits: number,
        sprite: string,
        size: readonly [number, number] = [16, 8],
    ): void {
        // The projectile length covers at least one 64 Hz movement step. Its
        // muzzle remains inside the actor, including the longer energy lance.
        user.ObjectsFactory.instantiateWithPosition("FireBall", position, [...size], undefined, undefined, (object) => {
            if (!(object instanceof FireBall)) throw new Error("Adventure weapons require the projectile prefab");
            object.setOwner(user);
            object.configureCombat(Math.round(damage), speed, lifetime, hits);
            object.Transform.Rotation = rotation;
            object.SpriteName = sprite;
        });
    }

    equip(): void {}
    hide(): void {}
}
