/** Presentation time is advanced only by the owning renderer, never Pixi's global ticker. */
export class AnimationClock {
    private elapsed = 0;

    get elapsedMs(): number {
        return this.elapsed;
    }

    public advance(deltaMs: number): void {
        if (Number.isFinite(deltaMs) && deltaMs > 0) this.elapsed += deltaMs;
    }

    public reset(): void {
        this.elapsed = 0;
    }

    public frame(frameCount: number, framesPerSecond: number): number {
        if (frameCount <= 1) return 0;
        // Avoid a one-frame discrepancy when equal elapsed times differ by floating point roundoff.
        return Math.floor((this.elapsed * framesPerSecond) / 1000 + 1e-9) % frameCount;
    }
}

/** A stable phase prevents a crowd from breathing in unison without using wall-clock time or randomness. */
export function presentationPhase(id: string): number {
    let hash = 0;
    for (let index = 0; index < id.length; index++) hash = (Math.imul(hash, 31) + id.charCodeAt(index)) >>> 0;
    return ((hash % 1000) / 1000) * Math.PI * 2;
}

export class ActorFeedback {
    private previousHp: number;
    private hitRemainingMs = 0;
    private trailDelayMs = 0;
    private healthTrail: number;

    constructor(hp: number, maxHp: number) {
        this.previousHp = hp;
        this.healthTrail = this.ratio(hp, maxHp);
    }

    get hit(): number {
        return this.hitRemainingMs / 180;
    }

    get trail(): number {
        return this.healthTrail;
    }

    public update(hp: number, maxHp: number, deltaMs: number): void {
        const elapsed = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
        const health = this.ratio(hp, maxHp);
        if (hp < this.previousHp) {
            this.hitRemainingMs = 180;
            this.trailDelayMs = 120;
        } else {
            this.hitRemainingMs = Math.max(0, this.hitRemainingMs - elapsed);
        }
        if (health >= this.healthTrail) {
            this.healthTrail = health;
            this.trailDelayMs = 0;
        } else {
            const decayMs = Math.max(0, elapsed - this.trailDelayMs);
            this.trailDelayMs = Math.max(0, this.trailDelayMs - elapsed);
            this.healthTrail = health + (this.healthTrail - health) * Math.exp(-decayMs / 110);
            if (this.healthTrail - health < 0.001) this.healthTrail = health;
        }
        this.previousHp = hp;
    }

    private ratio(hp: number, maxHp: number): number {
        return maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0;
    }
}
