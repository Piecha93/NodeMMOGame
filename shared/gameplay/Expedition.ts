export const ExpeditionEvents = Object.freeze({
    STATE: "expedition:state",
    RESTART: "expedition:restart",
});

export type ExpeditionPhase = "waiting" | "active" | "won" | "lost";
export type EncounterStage = "preparing" | "combat" | "rest" | "complete";
export type CampStatus = "guarded" | "ready" | "collected";

export interface EncounterState {
    readonly stage: EncounterStage;
    readonly wave: number;
    readonly completedWaves: number;
    readonly enemiesRemaining: number;
    readonly stageRemainingMs: number;
    readonly kills: number;
}

/** Kept for the existing marker transport; village rounds no longer create camps. */
export interface ExpeditionCampState {
    readonly id: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly status: CampStatus;
    readonly guardsRemaining: number;
}

export interface ExpeditionPlayerState {
    readonly id: string;
    readonly name: string;
    readonly hp: number;
    readonly maxHp: number;
    readonly respawnInMs: number;
}

export interface ExpeditionState {
    readonly round: number;
    readonly phase: ExpeditionPhase;
    readonly remainingMs: number;
    readonly collected: number;
    readonly total: number;
    readonly kills: number;
    readonly waveStage: EncounterStage;
    readonly wave: number;
    readonly enemiesRemaining: number;
    readonly stageRemainingMs: number;
    readonly home: { readonly x: number; readonly y: number; readonly radius: number };
    readonly camps: readonly ExpeditionCampState[];
    readonly party: readonly ExpeditionPlayerState[];
}

export const VILLAGE_WAVES = Object.freeze([4, 6, 8, 10, 12, 15] as const);
export const VILLAGE_PREPARATION_MS = 15_000;
export const VILLAGE_REST_MS = 20_000;

export const EXPEDITION = Object.freeze({
    durationMs: 8 * 60 * 1000,
    maxPlayers: 4,
    home: Object.freeze({ x: 640, y: 640, radius: 110 }),
    camps: Object.freeze([] as readonly Omit<ExpeditionCampState, "status" | "guardsRemaining">[]),
});

export function isEncounterStage(value: unknown): value is EncounterStage {
    return value === "preparing" || value === "combat" || value === "rest" || value === "complete";
}

/** Treat gameplay messages as an untrusted transport boundary, too. */
export function isExpeditionState(value: unknown): value is ExpeditionState {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const state = value as Record<string, unknown>;
    const number = (entry: unknown, max = 1_000_000): entry is number =>
        typeof entry === "number" && Number.isFinite(entry) && entry >= 0 && entry <= max;
    const integer = (entry: unknown, max: number): entry is number => number(entry, max) && Number.isInteger(entry);
    const text = (entry: unknown): entry is string => typeof entry === "string" && entry.length <= 128;
    if (
        !integer(state.round, 1_000_000) ||
        state.round === 0 ||
        typeof state.phase !== "string" ||
        !["waiting", "active", "won", "lost"].includes(state.phase) ||
        !number(state.remainingMs, EXPEDITION.durationMs) ||
        !integer(state.collected, VILLAGE_WAVES.length) ||
        state.total !== VILLAGE_WAVES.length ||
        !integer(state.kills, 1_000_000) ||
        !isEncounterStage(state.waveStage) ||
        !integer(state.wave, VILLAGE_WAVES.length) ||
        !integer(state.enemiesRemaining, 15) ||
        !number(state.stageRemainingMs, VILLAGE_REST_MS) ||
        state.collected > state.wave
    )
        return false;
    const home = state.home as Record<string, unknown> | undefined;
    if (!home || !number(home.x) || !number(home.y) || !number(home.radius, 1000)) return false;
    if (
        !Array.isArray(state.camps) ||
        state.camps.length !== 0 ||
        !Array.isArray(state.party) ||
        state.party.length > EXPEDITION.maxPlayers
    )
        return false;
    const playerIds = new Set<string>();
    return state.party.every((entry: unknown) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
        const player = entry as Record<string, unknown>;
        if (!text(player.id) || !player.id || playerIds.has(player.id)) return false;
        playerIds.add(player.id);
        return (
            text(player.name) &&
            integer(player.hp, 65535) &&
            integer(player.maxHp, 65535) &&
            player.maxHp > 0 &&
            player.hp <= player.maxHp &&
            number(player.respawnInMs, 10_000)
        );
    });
}
