import { Transform } from "../../physics/Transform";
import { Actor } from "./Actor";
import { MagicWand } from "../weapons/MagicWand";
import { Player } from "./Player";
import type { PerformanceScenario } from "../../../gameplay/Performance";
import { ChangesDict } from "../../../core/ChangeKeys";
import { FireBall } from "./FireBall";
import { projectileAim } from "../../../core/Aiming";
import { villageLineClear, villageWaypoint } from "../../../gameplay/VillageNavigation";

export type AdventureEnemyKind = "runner" | "ranged" | "brute";

const ADVENTURE_ENEMIES = {
    runner: { name: "Biegacz", hp: 45, speed: 0.145, range: 38, damage: 12, cooldown: 850 },
    ranged: { name: "Plujek", hp: 80, speed: 0.075, range: 230, damage: 14, cooldown: 1800 },
    brute: { name: "Koloss", hp: 550, speed: 0.065, range: 48, damage: 28, cooldown: 1300 },
} as const;

export class Enemy extends Actor {
    private homePosition: readonly [number, number];
    private returningHome = false;
    private performanceSetup: { scenario: PerformanceScenario; phase: number; players: () => Iterable<Player> } | null =
        null;
    private performanceShotsAtMs = 0;
    private adventureKind: AdventureEnemyKind | null = null;
    private adventureAttackAtMs = 0;
    private adventureNovaAtMs = 0;
    private navigationAtMs = 0;
    private navigationWaypoint: [number, number] | null = null;
    private navigationGoal = "";
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
        this.navigationAtMs = 0;
        this.navigationWaypoint = null;
        this.navigationGoal = "";
    }

    public configureAdventure(kind: AdventureEnemyKind): void {
        if (this.Runtime.isClient || this.Runtime.config.performanceMode)
            throw new Error("Adventure enemies require an ordinary server world");
        if (!Object.hasOwn(ADVENTURE_ENEMIES, kind)) throw new RangeError("Invalid adventure enemy kind");
        const profile = ADVENTURE_ENEMIES[kind];
        this.adventureKind = kind;
        this.Name = profile.name;
        this.SpriteName = "wraith";
        this.configureVitals(profile.hp);
        this.velocity = profile.speed;
        this.addChange(ChangesDict.VELOCITY);
        this.adventureAttackAtMs = this.Runtime.timeMs + 700;
        this.adventureNovaAtMs = this.Runtime.timeMs + 2500;
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
        if (this.adventureKind) {
            this.updateAdventure(delta, this.adventureKind);
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

    private updateAdventure(delta: number, kind: AdventureEnemyKind): void {
        const profile = ADVENTURE_ENEMIES[kind];
        let target: Player | null = null;
        let distanceSquared = Infinity;
        for (const player of this.ObjectsFactory.Manager.objectsOfType(Player)) {
            if (player.IsDestroyed || player.HP <= 0) continue;
            const dx = player.Transform.X - this.Transform.X;
            const dy = player.Transform.Y - this.Transform.Y;
            const distance = dx * dx + dy * dy;
            if (distance < distanceSquared) {
                target = player;
                distanceSquared = distance;
            }
        }
        if (!target) {
            this.Horizontal = 0;
            this.Vertical = 0;
            return;
        }
        const from = this.Transform.Position;
        const to = target.Transform.Position;
        const attackClear = villageLineClear(from, to, 2);
        if (distanceSquared > profile.range * profile.range || !attackClear) {
            const goal = `${Math.floor(to[0] / 32)},${Math.floor(to[1] / 32)}`;
            if (
                this.Runtime.timeMs >= this.navigationAtMs ||
                goal !== this.navigationGoal ||
                (this.navigationWaypoint &&
                    Math.hypot(from[0] - this.navigationWaypoint[0], from[1] - this.navigationWaypoint[1]) < 8)
            ) {
                this.navigationAtMs = this.Runtime.timeMs + 400;
                this.navigationGoal = goal;
                this.navigationWaypoint = villageWaypoint(from, to);
            }
            if (this.navigationWaypoint) this.moveToward(this.navigationWaypoint, delta);
            else {
                this.Horizontal = 0;
                this.Vertical = 0;
            }
        } else {
            this.Horizontal = 0;
            this.Vertical = 0;
            if (this.Runtime.timeMs >= this.adventureAttackAtMs) {
                this.adventureAttackAtMs = this.Runtime.timeMs + profile.cooldown;
                if (kind === "ranged") this.adventureShot(target.Transform.Position, profile.damage);
                else target.hit(profile.damage);
            }
        }
        // The final heavy enemy adds slow, dodgeable rings instead of fast
        // overlapping gunfire. Every attack uses authoritative simulation time.
        if (
            kind === "brute" &&
            attackClear &&
            distanceSquared < 500 * 500 &&
            this.Runtime.timeMs >= this.adventureNovaAtMs
        ) {
            this.adventureNovaAtMs = this.Runtime.timeMs + 3500;
            for (let index = 0; index < 8; index++) {
                const angle = (index / 8) * Math.PI * 2;
                this.adventureShot(
                    [this.Transform.X + Math.cos(angle) * 200, this.Transform.Y + Math.sin(angle) * 200],
                    12,
                    0.24,
                );
            }
        }
    }

    private adventureShot(target: readonly [number, number], power: number, speed = 0.33): void {
        const aim = projectileAim(this.Transform.Position, target, [this.Transform.ScaleX, this.Transform.ScaleY]);
        if (!aim) return;
        this.ObjectsFactory.instantiateWithPosition(
            "FireBall",
            aim.position,
            [14, 9],
            undefined,
            undefined,
            (object) => {
                const shot = object as FireBall;
                shot.setOwner(this);
                shot.Transform.Rotation = aim.rotation;
                shot.SpriteName = "fireball";
                shot.configureCombat(power, speed, 1800);
            },
        );
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
