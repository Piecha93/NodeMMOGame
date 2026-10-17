import { GameCore } from "../../shared/GameCore";
import {
    EXPEDITION,
    EncounterState,
    ExpeditionPhase,
    ExpeditionState,
    VILLAGE_PREPARATION_MS,
    VILLAGE_WAVES,
} from "../../shared/gameplay/Expedition";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { Player } from "../../shared/game_utils/game/objects/Player";

const SPAWN_OFFSETS = [
    [-76, 0],
    [76, 0],
    [0, -76],
    [0, 76],
] as const;

function freshEncounter(): EncounterState {
    return {
        stage: "preparing",
        wave: 0,
        completedWaves: 0,
        enemiesRemaining: 0,
        stageRemainingMs: VILLAGE_PREPARATION_MS,
        kills: 0,
    };
}

/** Owns the village round and party; AdventureController owns its finite encounters. */
export class ExpeditionController {
    private readonly players = new Map<string, Player>();
    private readonly spawnSlots = new Map<string, number>();
    private encounter = freshEncounter();
    private phase: ExpeditionPhase = "waiting";
    private remainingMs: number = EXPEDITION.durationMs;
    private round = 1;
    private started = false;
    private disposed = false;

    constructor(private readonly core: GameCore) {}

    start(): void {
        this.assertActive();
        if (this.started) return;
        this.started = true;
        this.core.ObjectsFactory.instantiateWithPosition(
            "ExpeditionMarker",
            [EXPEDITION.home.x, EXPEDITION.home.y],
            112,
            undefined,
            undefined,
            (object) => {
                object.SpriteName = "portal";
            },
        );
    }

    spawnPosition(index: number): [number, number] {
        if (!Number.isInteger(index) || index < 0) throw new RangeError("Invalid expedition spawn index");
        const offset = SPAWN_OFFSETS[index % SPAWN_OFFSETS.length];
        if (!offset) throw new Error("Missing expedition spawn");
        return [EXPEDITION.home.x + offset[0], EXPEDITION.home.y + offset[1]];
    }

    join(player: Player): void {
        this.assertActive();
        if (player.IsDestroyed || player.Runtime !== this.core.Runtime)
            throw new Error("Expedition players must belong to its world");
        if (this.players.has(player.ID)) return;
        if (this.players.size >= EXPEDITION.maxPlayers) throw new Error("Expedition party is full");
        const index = SPAWN_OFFSETS.findIndex(
            (_position, candidate) => !Array.from(this.spawnSlots.values()).includes(candidate),
        );
        player.configureRespawn(this.spawnPosition(index));
        player.respawn();
        this.core.ChunksManager.rebuildOne(player);
        this.players.set(player.ID, player);
        this.spawnSlots.set(player.ID, index);
        if (this.phase === "waiting") this.phase = "active";
    }

    leave(id: string): void {
        this.assertActive();
        this.players.delete(id);
        this.spawnSlots.delete(id);
        if (this.players.size === 0 && this.phase === "active") this.phase = "waiting";
    }

    update(delta: number): void {
        this.assertActive();
        if (!Number.isFinite(delta) || delta < 0) throw new RangeError("Invalid expedition delta");
        if (!this.started || this.phase !== "active" || this.players.size === 0) return;
        this.remainingMs = Math.max(0, this.remainingMs - delta);
        if (this.remainingMs === 0) this.finish("lost");
    }

    setEncounterState(state: EncounterState): void {
        this.assertActive();
        this.encounter = { ...state };
        if (this.phase === "active" && state.stage === "complete" && state.completedWaves === VILLAGE_WAVES.length) {
            this.finish("won");
        }
    }

    state(): ExpeditionState {
        this.assertActive();
        return {
            round: this.round,
            phase: this.phase,
            remainingMs: this.remainingMs,
            collected: this.encounter.completedWaves,
            total: VILLAGE_WAVES.length,
            kills: this.encounter.kills,
            waveStage: this.encounter.stage,
            wave: this.encounter.wave,
            enemiesRemaining: this.encounter.enemiesRemaining,
            stageRemainingMs: this.encounter.stageRemainingMs,
            home: { ...EXPEDITION.home },
            camps: [],
            party: Array.from(this.players.values(), (player) => ({
                id: player.ID,
                name: player.Name,
                hp: player.HP,
                maxHp: player.MaxHP,
                respawnInMs: player.RespawnInMs,
            })),
        };
    }

    restart(): boolean {
        this.assertActive();
        if (this.phase !== "won" && this.phase !== "lost") return false;
        this.clearPlayerProjectiles();
        this.encounter = freshEncounter();
        this.remainingMs = EXPEDITION.durationMs;
        this.round = Math.min(1_000_000, this.round + 1);
        this.phase = this.players.size === 0 ? "waiting" : "active";
        for (const player of this.players.values()) {
            player.configureRespawn(this.spawnPosition(this.spawnSlots.get(player.ID) ?? 0));
            player.respawn();
            this.core.ChunksManager.rebuildOne(player);
        }
        return true;
    }

    dispose(): void {
        if (this.disposed) return;
        this.clearPlayerProjectiles();
        this.players.clear();
        this.spawnSlots.clear();
        this.disposed = true;
    }

    private clearPlayerProjectiles(): void {
        for (const object of Array.from(this.core.ObjectsManager.ObjectsById.values())) {
            if (object instanceof FireBall && this.players.has(object.Owner)) object.destroy();
        }
    }

    private finish(phase: "won" | "lost"): void {
        this.phase = phase;
        this.clearPlayerProjectiles();
    }

    private assertActive(): void {
        if (this.disposed) throw new Error("Expedition is disposed");
    }
}
