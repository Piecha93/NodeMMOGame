import type { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { EntityState } from "../../shared/protocol";

interface PositionSample {
    time: number;
    x: number;
    y: number;
}

interface ProjectileTrack extends PositionSample {
    velocityX: number;
    velocityY: number;
    anchorTime: number;
    anchorReceivedAt: number;
}

export class SnapshotInterpolator {
    private readonly samples = new Map<string, PositionSample[]>();
    private readonly projectiles = new Map<string, ProjectileTrack>();
    private readonly presented = new Map<string, [number, number]>();
    private lastTick: number | null = null;
    private serverTime = 0;
    private receivedAt = 0;

    constructor(
        private readonly fixedDeltaMs: number,
        private readonly delayMs = 100,
        private readonly clock: () => number = () => performance.now(),
    ) {}

    push(tick: number, states: readonly EntityState[]): void {
        this.beginSnapshot(tick);
        const visible = new Set<string>();
        for (const state of states) {
            visible.add(state.id);
            this.pushPosition(
                state.id,
                state.prefab === "FireBall",
                state.transform.x,
                state.transform.y,
                state.transform.rotation,
                typeof state.fields.velocity === "number" ? state.fields.velocity : 0,
            );
        }
        this.removeAbsent(visible);
    }

    /** Read presentation inputs without allocating a complete wire state for every replica. */
    pushObjects(tick: number, objects: Iterable<GameObject>, excludedId?: string): void {
        this.beginSnapshot(tick);
        const visible = new Set<string>();
        for (const object of objects) {
            if (object.ID === excludedId || object.IsDestroyed) continue;
            visible.add(object.ID);
            this.pushPosition(
                object.ID,
                object.ObjectsFactory.Catalog.IdToPrefabNames.get(object.ID.charAt(0)) === "FireBall",
                object.Transform.X,
                object.Transform.Y,
                object.Transform.Rotation,
                object.Velocity,
            );
        }
        this.removeAbsent(visible);
    }

    private beginSnapshot(tick: number): void {
        if (this.lastTick !== null) this.serverTime += ((tick - this.lastTick) >>> 0) * this.fixedDeltaMs;
        this.lastTick = tick;
        this.receivedAt = this.clock();
    }

    private removeAbsent(visible: ReadonlySet<string>): void {
        for (const id of this.samples.keys()) if (!visible.has(id)) this.samples.delete(id);
        for (const id of this.projectiles.keys()) if (!visible.has(id)) this.projectiles.delete(id);
        for (const id of this.presented.keys()) if (!visible.has(id)) this.presented.delete(id);
    }

    private pushPosition(
        id: string,
        projectile: boolean,
        x: number,
        y: number,
        rotation: number,
        velocity: number,
    ): void {
        if (projectile) {
            this.pushProjectile(id, x, y, rotation, velocity);
            return;
        }
        const history = this.samples.get(id) ?? [];
        const last = history.at(-1);
        const sample = { time: this.serverTime, x, y };
        if (last?.time === sample.time) history[history.length - 1] = sample;
        else history.push(sample);
        while (history.length > 32) history.shift();
        this.samples.set(id, history);
    }

    /** Positions are a reusable presentation view, updated in place on the next call. */
    positions(): Map<string, [number, number]> {
        const now = this.clock();
        const target = this.serverTime + Math.max(0, now - this.receivedAt) - this.delayMs;
        for (const [id, history] of this.samples) {
            const first = history[0];
            const last = history.at(-1);
            if (!first || !last) continue;
            let x = target <= first.time ? first.x : last.x;
            let y = target <= first.time ? first.y : last.y;
            if (first.time < target && target < last.time) {
                // The render time is normally close to the newest samples.
                for (let i = history.length - 2; i >= 0; i--) {
                    const before = history[i];
                    const after = history[i + 1];
                    if (before && after && before.time <= target) {
                        const factor = (target - before.time) / (after.time - before.time);
                        x = before.x + (after.x - before.x) * factor;
                        y = before.y + (after.y - before.y) * factor;
                        break;
                    }
                }
            }
            this.setPosition(id, x, y);
        }
        for (const [id, projectile] of this.projectiles) {
            // A short lived projectile cannot wait 100 ms for a second sample. Its straight trajectory
            // is already known. Anchor its clock once so packet arrival jitter cannot reset the flight.
            const flightTime = projectile.anchorTime + Math.max(0, now - projectile.anchorReceivedAt);
            const extrapolationMs = Math.max(-80, Math.min(80, flightTime - projectile.time));
            this.setPosition(
                id,
                projectile.x + projectile.velocityX * extrapolationMs,
                projectile.y + projectile.velocityY * extrapolationMs,
            );
        }
        return this.presented;
    }

    private setPosition(id: string, x: number, y: number): void {
        const position = this.presented.get(id);
        if (position) {
            position[0] = x;
            position[1] = y;
        } else this.presented.set(id, [x, y]);
    }

    private pushProjectile(id: string, x: number, y: number, rotation: number, velocity: number): void {
        const velocityX = Math.cos(rotation) * velocity;
        const velocityY = Math.sin(rotation) * velocity;
        const previous = this.projectiles.get(id);
        const elapsed = previous ? this.serverTime - previous.time : 0;
        const sameTrajectory =
            previous !== undefined &&
            Math.abs(previous.velocityX - velocityX) < 1e-6 &&
            Math.abs(previous.velocityY - velocityY) < 1e-6 &&
            Math.hypot(
                x - (previous.x + previous.velocityX * elapsed),
                y - (previous.y + previous.velocityY * elapsed),
            ) < 1;
        this.projectiles.set(id, {
            x,
            y,
            time: this.serverTime,
            velocityX,
            velocityY,
            anchorTime: sameTrajectory ? previous.anchorTime : this.serverTime,
            anchorReceivedAt: sameTrajectory ? previous.anchorReceivedAt : this.receivedAt,
        });
    }
}
