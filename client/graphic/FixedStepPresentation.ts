type Position = readonly [number, number];

/** Draw between completed prediction steps, with one fixed tick of latency and no extra movement lerp. */
export class FixedStepPresentation {
    private previous: [number, number] | null = null;
    private current: [number, number] | null = null;
    private static readonly SNAP_DISTANCE = 96;

    reset(position: Position): void {
        this.previous = [...position];
        this.current = [...position];
    }

    capture(position: Position): void {
        if (!this.current || this.distance(position, this.current) > FixedStepPresentation.SNAP_DISTANCE) {
            this.reset(position);
            return;
        }
        this.previous = this.current;
        this.current = [...position];
    }

    reconcile(position: Position, respawn = false): void {
        if (
            !this.current ||
            !this.previous ||
            respawn ||
            this.distance(position, this.current) > FixedStepPresentation.SNAP_DISTANCE
        ) {
            this.reset(position);
            return;
        }
        // Reconciliation corrects the simulated present. Apply that same offset to both ends
        // rather than interpolating through a correction as if it were another movement tick.
        const dx = position[0] - this.current[0];
        const dy = position[1] - this.current[1];
        this.previous = [this.previous[0] + dx, this.previous[1] + dy];
        this.current = [...position];
    }

    position(alpha: number): [number, number] | undefined {
        if (!this.previous || !this.current) return undefined;
        const factor = Math.max(0, Math.min(1, alpha));
        return [
            this.previous[0] + (this.current[0] - this.previous[0]) * factor,
            this.previous[1] + (this.current[1] - this.previous[1]) * factor,
        ];
    }

    private distance(a: Position, b: Position): number {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
}
