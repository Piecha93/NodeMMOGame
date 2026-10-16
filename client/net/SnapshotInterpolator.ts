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
    private lastTick: number | null = null;
    private serverTime = 0;
    private receivedAt = 0;

    constructor(
        private readonly fixedDeltaMs: number,
        private readonly delayMs = 100,
        private readonly clock: () => number = () => performance.now(),
    ) {}

    push(tick: number, states: readonly EntityState[]): void {
        if (this.lastTick !== null) this.serverTime += ((tick - this.lastTick) >>> 0) * this.fixedDeltaMs;
        this.lastTick = tick;
        this.receivedAt = this.clock();
        const visible = new Set(states.map((state) => state.id));
        for (const id of this.samples.keys()) if (!visible.has(id)) this.samples.delete(id);
        for (const id of this.projectiles.keys()) if (!visible.has(id)) this.projectiles.delete(id);
        for (const state of states) {
            if (state.prefab === "FireBall") {
                this.pushProjectile(state);
                continue;
            }
            const history = this.samples.get(state.id) ?? [];
            const last = history.at(-1);
            const sample = { time: this.serverTime, x: state.transform.x, y: state.transform.y };
            if (last?.time === sample.time) history[history.length - 1] = sample;
            else history.push(sample);
            while (history.length > 32) history.shift();
            this.samples.set(state.id, history);
        }
    }

    positions(): Map<string, [number, number]> {
        const now = this.clock();
        const target = this.serverTime + Math.max(0, now - this.receivedAt) - this.delayMs;
        const result = new Map<string, [number, number]>();
        for (const [id, history] of this.samples) {
            const first = history[0];
            const last = history.at(-1);
            if (!first || !last) continue;
            let position: [number, number] = target <= first.time ? [first.x, first.y] : [last.x, last.y];
            for (let i = 1; i < history.length; i++) {
                const before = history[i - 1];
                const after = history[i];
                if (before && after && before.time <= target && target <= after.time) {
                    const factor = (target - before.time) / (after.time - before.time);
                    position = [before.x + (after.x - before.x) * factor, before.y + (after.y - before.y) * factor];
                    break;
                }
            }
            result.set(id, position);
        }
        for (const [id, projectile] of this.projectiles) {
            // A short lived projectile cannot wait 100 ms for a second sample. Its straight trajectory
            // is already known. Anchor its clock once so packet arrival jitter cannot reset the flight.
            const flightTime = projectile.anchorTime + Math.max(0, now - projectile.anchorReceivedAt);
            const extrapolationMs = Math.max(-80, Math.min(80, flightTime - projectile.time));
            result.set(id, [
                projectile.x + projectile.velocityX * extrapolationMs,
                projectile.y + projectile.velocityY * extrapolationMs,
            ]);
        }
        return result;
    }

    private pushProjectile(state: EntityState): void {
        const velocity = typeof state.fields.velocity === "number" ? state.fields.velocity : 0;
        const velocityX = Math.cos(state.transform.rotation) * velocity;
        const velocityY = Math.sin(state.transform.rotation) * velocity;
        const previous = this.projectiles.get(state.id);
        const elapsed = previous ? this.serverTime - previous.time : 0;
        const sameTrajectory =
            previous !== undefined &&
            Math.abs(previous.velocityX - velocityX) < 1e-6 &&
            Math.abs(previous.velocityY - velocityY) < 1e-6 &&
            Math.hypot(
                state.transform.x - (previous.x + previous.velocityX * elapsed),
                state.transform.y - (previous.y + previous.velocityY * elapsed),
            ) < 1;
        this.projectiles.set(state.id, {
            x: state.transform.x,
            y: state.transform.y,
            time: this.serverTime,
            velocityX,
            velocityY,
            anchorTime: sameTrajectory ? previous.anchorTime : this.serverTime,
            anchorReceivedAt: sameTrajectory ? previous.anchorReceivedAt : this.receivedAt,
        });
    }
}
