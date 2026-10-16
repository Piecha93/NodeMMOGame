export const ExpeditionEvents = Object.freeze({
    STATE: "expedition:state",
    RESTART: "expedition:restart",
});

export type ExpeditionPhase = "waiting" | "active" | "won" | "lost";
export type CampStatus = "guarded" | "ready" | "collected";

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
    readonly home: { readonly x: number; readonly y: number; readonly radius: number };
    readonly camps: readonly ExpeditionCampState[];
    readonly party: readonly ExpeditionPlayerState[];
}

export const EXPEDITION = Object.freeze({
    durationMs: 10 * 60 * 1000,
    maxPlayers: 4,
    home: Object.freeze({ x: 640, y: 640, radius: 110 }),
    camps: Object.freeze([
        Object.freeze({ id: "watchtower", name: "Stara strażnica", x: 1536, y: 576 }),
        Object.freeze({ id: "quarry", name: "Kamienny krąg", x: 2688, y: 1472 }),
        Object.freeze({ id: "grove", name: "Zapomniany gaj", x: 1088, y: 2560 }),
    ]),
});

/** Treat gameplay messages as an untrusted transport boundary, too. */
export function isExpeditionState(value: unknown): value is ExpeditionState {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const state = value as Record<string, unknown>;
    const number = (entry: unknown, max = 1_000_000): entry is number =>
        typeof entry === "number" && Number.isFinite(entry) && entry >= 0 && entry <= max;
    const text = (entry: unknown): entry is string => typeof entry === "string" && entry.length <= 128;
    if (
        !number(state.round) ||
        !Number.isInteger(state.round) ||
        typeof state.phase !== "string" ||
        !["waiting", "active", "won", "lost"].includes(state.phase) ||
        !number(state.remainingMs, EXPEDITION.durationMs) ||
        !number(state.collected, 3) ||
        !Number.isInteger(state.collected) ||
        state.total !== 3 ||
        !number(state.kills) ||
        !Number.isInteger(state.kills)
    )
        return false;
    const home = state.home as Record<string, unknown> | undefined;
    if (!home || !number(home.x) || !number(home.y) || !number(home.radius, 1000)) return false;
    if (
        !Array.isArray(state.camps) ||
        state.camps.length !== 3 ||
        !Array.isArray(state.party) ||
        state.party.length > EXPEDITION.maxPlayers
    )
        return false;
    const campIds = new Set<string>();
    const playerIds = new Set<string>();
    return (
        state.camps.every((entry: unknown) => {
            if (!entry || typeof entry !== "object") return false;
            const camp = entry as Record<string, unknown>;
            if (!text(camp.id) || !camp.id || campIds.has(camp.id)) return false;
            campIds.add(camp.id);
            return (
                text(camp.name) &&
                number(camp.x) &&
                number(camp.y) &&
                typeof camp.status === "string" &&
                ["guarded", "ready", "collected"].includes(camp.status) &&
                number(camp.guardsRemaining, 16) &&
                Number.isInteger(camp.guardsRemaining)
            );
        }) &&
        state.party.every((entry: unknown) => {
            if (!entry || typeof entry !== "object") return false;
            const player = entry as Record<string, unknown>;
            if (!text(player.id) || !player.id || playerIds.has(player.id)) return false;
            playerIds.add(player.id);
            return (
                text(player.name) &&
                number(player.hp, 65535) &&
                number(player.maxHp, 65535) &&
                (player.hp as number) <= (player.maxHp as number) &&
                number(player.respawnInMs, 10_000)
            );
        })
    );
}
