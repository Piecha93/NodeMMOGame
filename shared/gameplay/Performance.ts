export const PerformanceEvents = Object.freeze({
    CONFIGURE: "performance:configure",
    STATE: "performance:state",
});

export const PERFORMANCE_COUNTS = [0, 100, 500, 1000, 2000] as const;
export type PerformanceCount = (typeof PERFORMANCE_COUNTS)[number];
export type PerformanceDistribution = "nearby" | "world";
export type PerformanceScenario = "static" | "moving" | "combat";

export interface PerformanceConfiguration {
    readonly count: PerformanceCount;
    readonly distribution: PerformanceDistribution;
    readonly scenario: PerformanceScenario;
}

export interface PerformanceState extends PerformanceConfiguration {
    readonly enemies: number;
    readonly pending: number;
    readonly objects: number;
    readonly activeChunks: number;
    readonly totalChunks: number;
    readonly serverTick: number;
    readonly tickP50Ms: number;
    readonly tickP95Ms: number;
    readonly tickSamples: number;
    readonly tickBudgetMs: number;
    readonly droppedTimeMs: number;
    readonly snapshotBytesPerSecond: number;
}

export function validatePerformanceConfiguration(value: unknown): PerformanceConfiguration {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid performance setup");
    const setup = value as Record<string, unknown>;
    if (
        !PERFORMANCE_COUNTS.includes(setup.count as PerformanceCount) ||
        (setup.distribution !== "nearby" && setup.distribution !== "world") ||
        !["static", "moving", "combat"].includes(setup.scenario as string) ||
        Object.keys(setup).some((key) => !["count", "distribution", "scenario"].includes(key))
    )
        throw new Error("Invalid performance setup");
    return {
        count: setup.count as PerformanceCount,
        distribution: setup.distribution,
        scenario: setup.scenario as PerformanceScenario,
    };
}

export function isPerformanceState(value: unknown): value is PerformanceState {
    try {
        validatePerformanceConfiguration(
            value && typeof value === "object"
                ? {
                      count: (value as PerformanceState).count,
                      distribution: (value as PerformanceState).distribution,
                      scenario: (value as PerformanceState).scenario,
                  }
                : value,
        );
    } catch {
        return false;
    }
    const state = value as PerformanceState;
    return (
        [
            state.enemies,
            state.pending,
            state.objects,
            state.activeChunks,
            state.totalChunks,
            state.serverTick,
            state.tickP50Ms,
            state.tickP95Ms,
            state.tickSamples,
            state.tickBudgetMs,
            state.droppedTimeMs,
            state.snapshotBytesPerSecond,
        ].every((number) => Number.isFinite(number) && number >= 0) &&
        state.enemies <= 2000 &&
        state.pending <= 2000 &&
        state.activeChunks <= state.totalChunks
    );
}
