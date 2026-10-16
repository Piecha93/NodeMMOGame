import { Transform } from "../../physics/Transform";
import { Actor } from "./Actor";
import { MagicWand } from "../weapons/MagicWand";
import { Player } from "./Player";
import type { PerformanceScenario } from "../../../gameplay/Performance";

export class Enemy extends Actor {
    private homePosition: readonly [number, number];
    private returningHome = false;
    private performanceSetup: { scenario: PerformanceScenario; phase: number; players: () => Iterable<Player> } | null =
        null;
    private performanceShotsAtMs = 0;
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

    public configurePerformance(scenario: PerformanceScenario, phase: number, players: () => Iterable<Player>): void {
        if (!this.Runtime.config.performanceMode) throw new Error("Performance enemies require a performance world");
        this.performanceSetup = { scenario, phase, players };
        this.performanceShotsAtMs = this.Runtime.timeMs + phase * 1200;
    }

    protected serverUpdate(delta: number) {
        if (this.HP <= 0) {
            this.destroy();
            return;
        }

        if (this.performanceSetup?.scenario === "static") {
            this.Horizontal = 0;
            this.Vertical = 0;
            return;
        }
        if (this.performanceSetup?.scenario === "moving") {
            const angle = this.Runtime.timeMs / 900 + this.performanceSetup.phase * Math.PI * 2;
            this.moveToward(
                [this.homePosition[0] + Math.cos(angle) * 24, this.homePosition[1] + Math.sin(angle) * 24],
                delta,
            );
            return;
        }

        const homeDx = this.Transform.X - this.homePosition[0];
        const homeDy = this.Transform.Y - this.homePosition[1];
        const homeDistanceSquared = homeDx * homeDx + homeDy * homeDy;
        if (homeDistanceSquared > Enemy.LEASH_RANGE * Enemy.LEASH_RANGE) this.returningHome = true;
        if (this.returningHome) {
            if (homeDistanceSquared <= 8 * 8) {
                this.returningHome = false;
                this.Horizontal = 0;
                this.Vertical = 0;
            } else {
                this.moveToward(this.homePosition, delta);
            }
            return;
        }

        let target: Player | null = null;
        let targetDistanceSquared = Enemy.AGGRO_RANGE * Enemy.AGGRO_RANGE;
        for (const object of this.performanceSetup?.players() ?? this.ObjectsFactory.Manager.objectsOfType(Player)) {
            if (object.HP <= 0 || object.IsDestroyed) continue;
            const dx = object.Transform.X - this.Transform.X;
            const dy = object.Transform.Y - this.Transform.Y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < targetDistanceSquared) {
                target = object;
                targetDistanceSquared = distanceSquared;
            }
        }

        if (!target || targetDistanceSquared <= Enemy.ATTACK_DISTANCE * Enemy.ATTACK_DISTANCE) {
            this.Horizontal = 0;
            this.Vertical = 0;
            if (!target) return;
        } else {
            this.moveToward(target.Transform.Position, delta);
        }
        if (!this.performanceSetup || this.Runtime.timeMs >= this.performanceShotsAtMs) {
            this.weapon?.use(this, target.Transform.Position, 0);
        }
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

    override hasStableCombatTeam(): boolean {
        return (
            this.constructor === Enemy &&
            Object.getPrototypeOf(this) === Enemy.prototype &&
            !Object.getOwnPropertyDescriptor(this, "CombatTeam") &&
            Object.getOwnPropertyDescriptor(Enemy.prototype, "CombatTeam")?.get === enemyCombatTeamGetter
        );
    }
}

const enemyCombatTeamGetter = Object.getOwnPropertyDescriptor(Enemy.prototype, "CombatTeam")?.get;
