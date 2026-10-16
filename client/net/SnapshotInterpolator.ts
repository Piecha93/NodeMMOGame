import { EntityState } from "../../shared/protocol";

interface PositionSample {
    time: number;
    x: number;
    y: number;
}

export class SnapshotInterpolator {
    private readonly samples = new Map<string, PositionSample[]>();
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
        for (const state of states) {
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
        const target = this.serverTime + Math.max(0, this.clock() - this.receivedAt) - this.delayMs;
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
        return result;
    }
}
