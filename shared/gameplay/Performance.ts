export const PerformanceEvents = Object.freeze({
    CONFIGURE: "performance:configure",
    STATE: "performance:state",
});

export const PERFORMANCE_MAX_ENEMIES = 20_000;
export type PerformanceDistribution = "nearby" | "world";
export type PerformanceScenario = "static" | "moving" | "combat";

export interface PerformanceConfiguration {
    readonly count: number;
    readonly distribution: PerformanceDistribution;
    readonly scenario: PerformanceScenario;
}

export interface PerformanceTelemetry {
    readonly simulationHz: number;
    readonly snapshotHz: number;
    readonly snapshotP95Ms: number;
}

export interface PerformanceState extends PerformanceConfiguration, PerformanceTelemetry {
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
        typeof setup.count !== "number" ||
        !Number.isInteger(setup.count) ||
        setup.count < 0 ||
        setup.count > PERFORMANCE_MAX_ENEMIES ||
        (setup.distribution !== "nearby" && setup.distribution !== "world") ||
        !["static", "moving", "combat"].includes(setup.scenario as string) ||
        Object.keys(setup).some((key) => !["count", "distribution", "scenario"].includes(key))
    )
        throw new Error("Invalid performance setup");
    return {
        count: setup.count,
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
            state.simulationHz,
            state.snapshotHz,
            state.snapshotP95Ms,
        ].every((number) => Number.isFinite(number) && number >= 0) &&
        Number.isInteger(state.enemies) &&
        Number.isInteger(state.pending) &&
        state.enemies <= PERFORMANCE_MAX_ENEMIES &&
        state.pending <= PERFORMANCE_MAX_ENEMIES &&
        state.activeChunks <= state.totalChunks
    );
}
