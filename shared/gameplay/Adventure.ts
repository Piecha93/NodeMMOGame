import { EncounterStage, VILLAGE_REST_MS, VILLAGE_WAVES, isEncounterStage } from "./Expedition";

export type WeaponId = "ember" | "scatter" | "lance";
export type UpgradeId = "power" | "haste" | "vitality" | "stride";
export type PurchaseId = "heal" | "training";

export const AdventureEvents = Object.freeze({
    STATE: "adventure:state",
    UPGRADE: "adventure:upgrade",
    WEAPON: "adventure:weapon",
    PURCHASE: "adventure:purchase",
});

export const WEAPONS = Object.freeze([
    Object.freeze({ id: "ember", name: "Żar", description: "Szybki, celny pocisk ognia.", unlockLevel: 1 }),
    Object.freeze({
        id: "scatter",
        name: "Rozprysk",
        description: "Wachlarz trzech pocisków na bliski dystans.",
        unlockLevel: 2,
    }),
    Object.freeze({ id: "lance", name: "Przebicie", description: "Mocna, szybka włócznia energii.", unlockLevel: 3 }),
] satisfies readonly {
    readonly id: WeaponId;
    readonly name: string;
    readonly description: string;
    readonly unlockLevel: number;
}[]);

export const UPGRADES = Object.freeze([
    Object.freeze({ id: "power", name: "Moc", description: "+18% obrażeń", maxRank: 5 }),
    Object.freeze({ id: "haste", name: "Szybkostrzelność", description: "−8% czasu między strzałami", maxRank: 5 }),
    Object.freeze({ id: "vitality", name: "Witalność", description: "+30 maksymalnego zdrowia", maxRank: 5 }),
    Object.freeze({ id: "stride", name: "Zwinność", description: "+5% prędkości ruchu", maxRank: 5 }),
] satisfies readonly {
    readonly id: UpgradeId;
    readonly name: string;
    readonly description: string;
    readonly maxRank: number;
}[]);

export const ADVENTURE_MAX_LEVEL = 20;

export interface AdventureBuild {
    readonly weapon: WeaponId;
    readonly damageMultiplier: number;
    readonly cooldownMultiplier: number;
    readonly movementMultiplier: number;
    readonly maxHp: number;
}

export interface AdventurePlayerState {
    readonly id: string;
    readonly level: number;
    readonly xp: number;
    readonly xpToNext: number;
    readonly points: number;
    readonly coins: number;
    readonly weapon: WeaponId;
    readonly upgrades: Readonly<Record<UpgradeId, number>>;
}

export interface AdventureState {
    readonly round: number;
    readonly wave: number;
    readonly nextWaveInMs: number;
    readonly stage: EncounterStage;
    readonly remainingEnemies: number;
    readonly players: readonly AdventurePlayerState[];
}

export function xpRequired(level: number): number {
    return level >= ADVENTURE_MAX_LEVEL ? 0 : 20 + (level - 1) * 15;
}

export function isWeaponId(value: unknown): value is WeaponId {
    return value === "ember" || value === "scatter" || value === "lance";
}

export function isUpgradeId(value: unknown): value is UpgradeId {
    return value === "power" || value === "haste" || value === "vitality" || value === "stride";
}

export function createAdventureBuild(weapon: WeaponId, upgrades: Readonly<Record<UpgradeId, number>>): AdventureBuild {
    return {
        weapon,
        damageMultiplier: 1 + upgrades.power * 0.18,
        cooldownMultiplier: 1 - upgrades.haste * 0.08,
        movementMultiplier: 1 + upgrades.stride * 0.05,
        maxHp: 200 + upgrades.vitality * 30,
    };
}

/** Bounded gameplay state is validated before it reaches the HUD or prediction. */
export function isAdventureState(value: unknown): value is AdventureState {
    const record = (entry: unknown): entry is Record<string, unknown> =>
        !!entry && typeof entry === "object" && !Array.isArray(entry);
    const integer = (entry: unknown, minimum: number, maximum: number): entry is number =>
        typeof entry === "number" && Number.isInteger(entry) && entry >= minimum && entry <= maximum;
    if (
        !record(value) ||
        !integer(value.round, 1, 1_000_000) ||
        !integer(value.wave, 0, VILLAGE_WAVES.length) ||
        !integer(value.nextWaveInMs, 0, VILLAGE_REST_MS) ||
        !isEncounterStage(value.stage) ||
        !integer(value.remainingEnemies, 0, 15) ||
        !Array.isArray(value.players) ||
        value.players.length > 4
    )
        return false;
    const ids = new Set<string>();
    return value.players.every((player: unknown) => {
        if (
            !record(player) ||
            typeof player.id !== "string" ||
            !player.id ||
            player.id.length > 128 ||
            ids.has(player.id) ||
            !integer(player.level, 1, ADVENTURE_MAX_LEVEL) ||
            !integer(player.points, 0, player.level - 1) ||
            !integer(player.coins, 0, 1_000_000_000) ||
            !isWeaponId(player.weapon) ||
            !record(player.upgrades) ||
            Object.keys(player.upgrades).length !== UPGRADES.length
        )
            return false;
        ids.add(player.id);
        const required = xpRequired(player.level);
        if (player.xpToNext !== required || !integer(player.xp, 0, Math.max(0, required - 1))) return false;
        let spent = 0;
        for (const upgrade of UPGRADES) {
            if (!Object.hasOwn(player.upgrades, upgrade.id)) return false;
            const rank = player.upgrades[upgrade.id];
            if (!integer(rank, 0, upgrade.maxRank)) return false;
            spent += rank;
        }
        const weapon = WEAPONS.find((entry) => entry.id === player.weapon);
        return spent + player.points === player.level - 1 && !!weapon && player.level >= weapon.unlockLevel;
    });
}
