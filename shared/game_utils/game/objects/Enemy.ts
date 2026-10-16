import { Transform } from "../../physics/Transform";
import { Actor } from "./Actor";
import { MagicWand } from "../weapons/MagicWand";
import { Player } from "./Player";

export class Enemy extends Actor {
    private homePosition: readonly [number, number];
    private returningHome = false;
    private static readonly AGGRO_RANGE = 480;
    private static readonly ATTACK_DISTANCE = 200;
    private static readonly LEASH_RANGE = 600;

    constructor(transform: Transform) {
        super(transform);
        this.homePosition = [...transform.Position];
        this.velocity = 0.11;
        this.configureVitals(100);
        this.weapon = new MagicWand(1200);
    }

    public setHomePosition(position: readonly [number, number]): void {
        if (!position.every(Number.isFinite)) throw new RangeError("Invalid enemy home position");
        this.homePosition = [...position];
        this.returningHome = false;
    }

    protected serverUpdate(delta: number) {
        if (this.HP <= 0) {
            this.destroy();
            return;
        }

        const homeDistance = Math.hypot(
            this.Transform.X - this.homePosition[0],
            this.Transform.Y - this.homePosition[1],
        );
        if (homeDistance > Enemy.LEASH_RANGE) this.returningHome = true;
        if (this.returningHome) {
            if (homeDistance <= 8) {
                this.returningHome = false;
                this.Horizontal = 0;
                this.Vertical = 0;
            } else {
                this.moveToward(this.homePosition, delta);
            }
            return;
        }

        let target: Player | null = null;
        let targetDistance = Enemy.AGGRO_RANGE;
        for (const object of this.ObjectsFactory.Manager.ObjectsById.values()) {
            if (!(object instanceof Player) || object.HP <= 0 || object.IsDestroyed) continue;
            const distance = Math.hypot(object.Transform.X - this.Transform.X, object.Transform.Y - this.Transform.Y);
            if (distance < targetDistance) {
                target = object;
                targetDistance = distance;
            }
        }

        this.Horizontal = 0;
        this.Vertical = 0;
        if (!target) return;
        if (targetDistance > Enemy.ATTACK_DISTANCE) this.moveToward(target.Transform.Position, delta);
        this.weapon?.use(this, target.Transform.Position, 0);
    }

    private moveToward(position: readonly [number, number], delta: number): void {
        const dx = position[0] - this.Transform.X;
        const dy = position[1] - this.Transform.Y;
        // Legacy inputs name the screen Y axis "horizontal" and X axis "vertical".
        this.Vertical = Math.abs(dx) > 4 ? Math.sign(dx) : 0;
        this.Horizontal = Math.abs(dy) > 4 ? Math.sign(dy) : 0;
        this.updatePosition(delta);
    }

    override get CombatTeam(): "enemies" {
        return "enemies";
    }
}
