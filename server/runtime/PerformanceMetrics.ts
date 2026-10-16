import { PerformanceTelemetry } from "../../shared/gameplay/Performance";

/** Wallclock rates include stalls between snapshots, unlike per-tick CPU timings. */
export class PerformanceMetrics {
    private windowStarted = 0;
    private windowTick = 0;
    private snapshots = 0;
    private simulationHz = 0;
    private snapshotHz = 0;
    private readonly snapshotDurations: number[] = [];

    constructor(now: number, serverTick: number) {
        this.reset(now, serverTick);
    }

    reset(now: number, serverTick: number): void {
        this.windowStarted = now;
        this.windowTick = serverTick >>> 0;
        this.snapshots = 0;
        this.simulationHz = 0;
        this.snapshotHz = 0;
        this.snapshotDurations.length = 0;
    }

    recordSnapshot(durationMs: number, now: number, serverTick: number): void {
        if (!Number.isFinite(durationMs) || durationMs < 0 || !Number.isFinite(now)) return;
        if (!Number.isInteger(serverTick) || serverTick < 0 || serverTick > 0xffffffff) return;
        if (now < this.windowStarted) this.reset(now, serverTick);
        this.snapshotDurations.push(durationMs);
        if (this.snapshotDurations.length > 128) this.snapshotDurations.shift();
        this.snapshots++;
        const elapsed = now - this.windowStarted;
        if (elapsed < 1000) return;
        this.simulationHz = (((serverTick - this.windowTick) >>> 0) * 1000) / elapsed;
        this.snapshotHz = (this.snapshots * 1000) / elapsed;
        this.windowStarted = now;
        this.windowTick = serverTick >>> 0;
        this.snapshots = 0;
    }

    read(): PerformanceTelemetry {
        const sorted = [...this.snapshotDurations].sort((left, right) => left - right);
        return {
            simulationHz: this.simulationHz,
            snapshotHz: this.snapshotHz,
            snapshotP95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
        };
    }
}
