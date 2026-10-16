/** Keeps callback work inside the period and drops expired scheduling deadlines. */
export class LoopSchedule {
    private deadline = 0;

    constructor(private readonly intervalMs: number) {
        if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError("Invalid loop interval");
    }

    reset(now: number): void {
        this.deadline = now;
    }

    nextDelay(now: number): number {
        // A late callback yields through a timer, then resumes from the present.
        // Simulation catch-up belongs to GameCore, never to a burst of timers.
        this.deadline = Math.max(this.deadline + this.intervalMs, now);
        return this.deadline - now;
    }
}
