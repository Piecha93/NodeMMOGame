import { GameCore } from "../../shared/GameCore";
import { EXPEDITION, CampStatus, ExpeditionPhase, ExpeditionState } from "../../shared/gameplay/Expedition";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Item } from "../../shared/game_utils/game/objects/Item";
import { Player } from "../../shared/game_utils/game/objects/Player";

type Position = readonly [number, number];

interface GuardSlot {
    readonly position: Position;
    hp: number | null;
    defeated: boolean;
    objectId: string | null;
}

interface PotionSlot {
    readonly position: Position;
    consumed: boolean;
    objectId: string | null;
}

interface Camp {
    readonly definition: (typeof EXPEDITION.camps)[number];
    readonly guards: GuardSlot[];
    readonly potions: PotionSlot[];
    status: CampStatus;
    coreId: string | null;
}

const GUARD_OFFSETS: readonly Position[] = [
    [-80, -48],
    [80, -48],
    [0, 90],
];
const POTION_OFFSETS: readonly Position[] = [
    [-90, 65],
    [90, 65],
];
const SPAWN_OFFSETS: readonly Position[] = [
    [-76, 0],
    [76, 0],
    [0, -76],
    [0, 76],
];
const CAMP_ACTIVATION_RADIUS = 600;
const CORE_PICKUP_RADIUS = 55;

/** Small authoritative round controller; it owns objectives, not transport or timers. */
export class ExpeditionController {
    private readonly players = new Map<string, Player>();
    private readonly spawnSlots = new Map<string, number>();
    private readonly guardSlots = new Map<string, GuardSlot>();
    private readonly potionSlots = new Map<string, PotionSlot>();
    private readonly combatantIds = new Set<string>();
    private readonly unsubscribeObjects: () => void;
    private camps = this.createCamps();
    private phase: ExpeditionPhase = "waiting";
    private remainingMs: number = EXPEDITION.durationMs;
    private kills = 0;
    private round = 1;
    private started = false;
    private disposed = false;
    private resetting = false;

    constructor(private readonly core: GameCore) {
        this.unsubscribeObjects = core.ObjectsManager.subscribe({
            destroyed: (object) => this.onDestroyed(object),
        });
    }

    start(): void {
        this.assertActive();
        if (this.started) return;
        this.started = true;
        this.createMarker([EXPEDITION.home.x, EXPEDITION.home.y], "portal", 112);
        this.seedRuins();
    }

    spawnPosition(index: number): [number, number] {
        if (!Number.isInteger(index) || index < 0) throw new RangeError("Invalid expedition spawn index");
        const offset = SPAWN_OFFSETS[index % SPAWN_OFFSETS.length];
        if (!offset) throw new Error("Missing expedition spawn");
        return [EXPEDITION.home.x + offset[0], EXPEDITION.home.y + offset[1]];
    }

    join(player: Player): void {
        this.assertActive();
        if (this.players.has(player.ID)) return;
        if (this.players.size >= EXPEDITION.maxPlayers) throw new Error("Expedition party is full");
        if (player.IsDestroyed || player.Runtime !== this.core.Runtime) {
            throw new Error("Expedition players must belong to its world");
        }
        const index = SPAWN_OFFSETS.findIndex(
            (_position, candidate) => !Array.from(this.spawnSlots.values()).includes(candidate),
        );
        const position = this.spawnPosition(index);
        player.configureRespawn(position);
        player.respawn();
        this.core.ChunksManager.rebuildOne(player);
        this.players.set(player.ID, player);
        this.spawnSlots.set(player.ID, index);
        this.combatantIds.add(player.ID);
        if (this.phase === "waiting") this.phase = "active";
    }

    leave(id: string): void {
        this.players.delete(id);
        this.spawnSlots.delete(id);
        if (this.players.size === 0 && this.phase === "active") this.phase = "waiting";
    }

    update(delta: number): void {
        this.assertActive();
        if (!Number.isFinite(delta) || delta < 0) throw new RangeError("Invalid expedition delta");
        if (!this.started || this.phase !== "active" || this.players.size === 0) return;

        this.remainingMs = Math.max(0, this.remainingMs - delta);
        if (this.remainingMs === 0) {
            this.finish("lost");
            return;
        }

        const living = this.livingPlayers();
        for (const camp of this.camps) {
            this.refreshGuards(camp);
            const nearby = living.some((player) => this.distanceTo(player, camp.definition) <= CAMP_ACTIVATION_RADIUS);
            if (!nearby) continue;
            this.populateCamp(camp);
            if (camp.status !== "ready") continue;

            this.ensureCore(camp);
            if (living.some((player) => this.distanceTo(player, camp.definition) <= CORE_PICKUP_RADIUS)) {
                camp.status = "collected";
                if (camp.coreId) this.core.ObjectsManager.destroy(camp.coreId);
                camp.coreId = null;
            }
        }

        if (
            this.camps.every((camp) => camp.status === "collected") &&
            living.length === this.players.size &&
            living.every((player) => this.distanceTo(player, EXPEDITION.home) <= EXPEDITION.home.radius)
        ) {
            this.finish("won");
        }
    }

    state(): ExpeditionState {
        return {
            round: this.round,
            phase: this.phase,
            remainingMs: this.remainingMs,
            collected: this.camps.filter((camp) => camp.status === "collected").length,
            total: EXPEDITION.camps.length,
            kills: this.kills,
            home: { ...EXPEDITION.home },
            camps: this.camps.map((camp) => ({
                ...camp.definition,
                status: camp.status,
                guardsRemaining: camp.guards.filter((slot) => !slot.defeated).length,
            })),
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
        this.resetting = true;
        try {
            // A sleeping chunk can still hold a persistent core in its dump.
            // Reload once before cleanup so an old objective cannot return later.
            for (const chunk of this.core.ChunksManager.ChunksIterator()) chunk.activate();
            const coreIds = new Set(this.camps.map((camp) => camp.coreId).filter((id) => id !== null));
            for (const object of Array.from(this.core.ObjectsManager.ObjectsById.values())) {
                if (
                    this.guardSlots.has(object.ID) ||
                    this.potionSlots.has(object.ID) ||
                    coreIds.has(object.ID) ||
                    (object instanceof FireBall && this.combatantIds.has(object.Owner))
                )
                    object.destroy();
            }
            this.guardSlots.clear();
            this.potionSlots.clear();
            this.combatantIds.clear();
            this.camps = this.createCamps();
            this.remainingMs = EXPEDITION.durationMs;
            this.kills = 0;
            this.round++;
            this.phase = this.players.size === 0 ? "waiting" : "active";
            for (const player of this.players.values()) {
                player.configureRespawn(this.spawnPosition(this.spawnSlots.get(player.ID) ?? 0));
                player.respawn();
                this.core.ChunksManager.rebuildOne(player);
                this.combatantIds.add(player.ID);
            }
            // The cleanup reload cancels sleeping-chunk timers. Restore them
            // after players move home so distant ruins can sleep again.
            for (const chunk of this.core.ChunksManager.ChunksIterator()) {
                if (!chunk.HasPlayersInNeighborhood) chunk.startDeactivationTimer();
            }
            return true;
        } finally {
            this.resetting = false;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.unsubscribeObjects();
        this.players.clear();
        this.spawnSlots.clear();
        this.guardSlots.clear();
        this.potionSlots.clear();
        this.combatantIds.clear();
    }

    private createCamps(): Camp[] {
        return EXPEDITION.camps.map((definition) => ({
            definition,
            status: "guarded",
            coreId: null,
            guards: GUARD_OFFSETS.map(([x, y]) => ({
                position: [definition.x + x, definition.y + y],
                hp: null,
                defeated: false,
                objectId: null,
            })),
            potions: POTION_OFFSETS.map(([x, y]) => ({
                position: [definition.x + x, definition.y + y],
                consumed: false,
                objectId: null,
            })),
        }));
    }

    private populateCamp(camp: Camp): void {
        for (const slot of camp.guards) {
            if (slot.defeated || slot.objectId || !this.isActivePosition(slot.position)) continue;
            this.core.ObjectsFactory.instantiateWithPosition(
                "Michau",
                [...slot.position],
                undefined,
                undefined,
                undefined,
                (object) => {
                    if (!(object instanceof Enemy)) throw new Error("Camp guards require the Enemy prefab");
                    object.Name = "Strażnik ruin";
                    object.SpriteName = "wraith";
                    object.setHomePosition(slot.position);
                    if (slot.hp !== null) object.hit(Math.max(0, object.MaxHP - slot.hp));
                    slot.hp = object.HP;
                    slot.objectId = object.ID;
                    this.guardSlots.set(object.ID, slot);
                    this.combatantIds.add(object.ID);
                },
            );
        }
        for (const slot of camp.potions) {
            if (slot.consumed || slot.objectId || !this.isActivePosition(slot.position)) continue;
            this.core.ObjectsFactory.instantiateWithPosition(
                "HpPotion",
                [...slot.position],
                undefined,
                undefined,
                undefined,
                (object) => {
                    slot.objectId = object.ID;
                    this.potionSlots.set(object.ID, slot);
                },
            );
        }
    }

    private refreshGuards(camp: Camp): void {
        for (const slot of camp.guards) {
            const object = slot.objectId ? this.core.ObjectsManager.get(slot.objectId) : undefined;
            if (!(object instanceof Enemy)) continue;
            slot.hp = object.HP;
            if (object.HP <= 0) object.destroy();
        }
        if (camp.status === "guarded" && camp.guards.every((slot) => slot.defeated)) camp.status = "ready";
    }

    private ensureCore(camp: Camp): void {
        if (camp.coreId && this.core.ObjectsManager.get(camp.coreId)) return;
        const position: Position = [camp.definition.x, camp.definition.y];
        if (!this.isActivePosition(position)) return;
        camp.coreId = this.createMarker(position, "bluebolt", 40).ID;
    }

    private onDestroyed(object: GameObject): void {
        if (this.resetting) return;
        const guard = this.guardSlots.get(object.ID);
        if (guard && object instanceof Enemy) {
            guard.hp = object.HP;
            guard.objectId = null;
            this.guardSlots.delete(object.ID);
            if (object.HP <= 0 && !guard.defeated) {
                guard.defeated = true;
                this.kills++;
            }
        }
        const potion = this.potionSlots.get(object.ID);
        if (potion && object instanceof Item) {
            potion.objectId = null;
            potion.consumed = object.Consumed;
            this.potionSlots.delete(object.ID);
        }
    }

    private seedRuins(): void {
        const positions = new Set<string>();
        const wall = (x: number, y: number) => {
            const key = `${x},${y}`;
            if (positions.has(key)) return;
            positions.add(key);
            this.core.ObjectsFactory.instantiateWithPosition("Wall", [x, y]);
        };
        // Broken corners define camps while keeping broad entrances on all sides.
        for (const { definition } of this.camps) {
            for (const x of [-160, -128, -96, 96, 128, 160]) {
                wall(definition.x + x, definition.y - 128);
                wall(definition.x + x, definition.y + 128);
            }
            for (const y of [-96, -64, 64, 96]) {
                wall(definition.x - 160, definition.y + y);
                wall(definition.x + 160, definition.y + y);
            }
        }
        for (const x of [-192, 192])
            for (const y of [-192, 192]) {
                wall(EXPEDITION.home.x + x, EXPEDITION.home.y + y);
                wall(EXPEDITION.home.x + x + 32, EXPEDITION.home.y + y);
            }
    }

    private createMarker(position: Position, sprite: string, size: number): GameObject {
        return this.core.ObjectsFactory.instantiateWithPosition(
            "ExpeditionMarker",
            [...position],
            size,
            undefined,
            undefined,
            (object) => {
                object.SpriteName = sprite;
            },
        );
    }

    private isActivePosition(position: Position): boolean {
        return this.core.ChunksManager.getChunkAtPosition(position[0], position[1])?.IsActive === true;
    }

    private livingPlayers(): Player[] {
        return Array.from(this.players.values()).filter(
            (player) => !player.IsDestroyed && player.HP > 0 && player.RespawnInMs === 0,
        );
    }

    private distanceTo(player: Player, target: { readonly x: number; readonly y: number }): number {
        return Math.hypot(player.Transform.X - target.x, player.Transform.Y - target.y);
    }

    private assertActive(): void {
        if (this.disposed) throw new Error("Expedition is disposed");
    }

    private finish(phase: "won" | "lost"): void {
        this.phase = phase;
        this.resetting = true;
        try {
            for (const object of Array.from(this.core.ObjectsManager.ObjectsById.values())) {
                if (
                    this.guardSlots.has(object.ID) ||
                    (object instanceof FireBall && this.combatantIds.has(object.Owner))
                ) {
                    object.destroy();
                }
            }
        } finally {
            this.resetting = false;
        }
    }
}
