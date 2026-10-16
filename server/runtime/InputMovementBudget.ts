/** Bound queued input simulation by elapsed server time, with a small jitter allowance. */
export class InputMovementBudget {
    private creditMs: number;
    private lastTimeMs: number;
    static readonly MAX_STEPS = 8;

    constructor(
        private readonly fixedDeltaMs: number,
        nowMs: number,
    ) {
        this.creditMs = fixedDeltaMs * InputMovementBudget.MAX_STEPS;
        this.lastTimeMs = nowMs;
    }

    take(queued: number, nowMs: number): number {
        // Clock injection makes overload tests deterministic. A clock adjustment
        // cannot create negative credit or refill the same elapsed time twice.
        const currentTimeMs = Math.max(this.lastTimeMs, nowMs);
        this.creditMs = Math.min(
            this.fixedDeltaMs * InputMovementBudget.MAX_STEPS,
            this.creditMs + currentTimeMs - this.lastTimeMs,
        );
        this.lastTimeMs = currentTimeMs;
        const steps = Math.min(
            queued,
            InputMovementBudget.MAX_STEPS,
            Math.floor((this.creditMs + 1e-9) / this.fixedDeltaMs),
        );
        this.creditMs -= steps * this.fixedDeltaMs;
        return steps;
    }
}
