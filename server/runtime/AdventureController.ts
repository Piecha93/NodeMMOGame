import { GameCore } from "../../shared/GameCore";
import {
    ADVENTURE_MAX_LEVEL,
    AdventureState,
    UpgradeId,
    WeaponId,
    WEAPONS,
    createAdventureBuild,
    isUpgradeId,
    isWeaponId,
    xpRequired,
} from "../../shared/gameplay/Adventure";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { ExpeditionMarker } from "../../shared/game_utils/game/objects/ExpeditionMarker";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Player } from "../../shared/game_utils/game/objects/Player";

interface Progression {
    readonly player: Player;
    level: number;
    xp: number;
    points: number;
    coins: number;
    weapon: WeaponId;
    upgrades: Record<UpgradeId, number>;
}

type LootKind = "xp" | "coin" | "heal";

interface Loot {
    readonly object: ExpeditionMarker;
    readonly kind: LootKind;
    readonly expiresAt: number;
}

const FIRST_WAVE_MS = 3000;
const WAVE_INTERVAL_MS = 12_000;
const MAX_LIVE_WAVE_ENEMIES = 32;
const MAX_DROPS = 128;
const LOOT_TTL_MS = 60_000;
const PICKUP_RADIUS = 52;
const MAGNET_RADIUS = 140;
const ENEMY_NAMES = ["Łowca żaru", "Strażnik echa", "Wędrowny zbir"] as const;

/** Run progression and bounded encounters; the performance world never creates this controller. */
export class AdventureController {
    private readonly players = new Map<string, Progression>();
    private readonly waveEnemies = new Map<string, Enemy>();
    private readonly waveProjectiles = new Set<FireBall>();
    private readonly drops = new Map<string, Loot>();
    private readonly pendingLoot: { readonly x: number; readonly y: number; readonly heal: boolean }[] = [];
    private readonly rewarded = new WeakSet<Enemy>();
    private readonly unsubscribeObjects: () => void;
    private round = 1;
    private wave = 0;
    private nextWaveInMs = FIRST_WAVE_MS;
    private elapsedMs = 0;
    private defeats = 0;
    private playable = true;
    private suppressRewards = false;
    private disposed = false;

    constructor(private readonly core: GameCore) {
        if (!core.Runtime.isServer || core.Runtime.config.performanceMode) {
            throw new Error("Adventure requires an ordinary server world");
        }
        this.unsubscribeObjects = core.ObjectsManager.subscribe({
            created: (object) => {
                // Weapons configure Owner before registration. Keep the actual
                // projectile until destruction, even after its enemy has died.
                if (object instanceof FireBall && this.waveEnemies.has(object.Owner)) this.waveProjectiles.add(object);
            },
            destroyed: (object) => this.onDestroyed(object),
        });
    }

    join(player: Player): void {
        this.assertActive();
        if (player.IsDestroyed || player.Runtime !== this.core.Runtime) {
            throw new Error("Adventure players must belong to its world");
        }
        if (this.players.has(player.ID)) return;
        if (this.players.size >= 4) throw new Error("Adventure party is full");
        const progress = this.initialProgression(player);
        this.players.set(player.ID, progress);
        this.applyBuild(progress);
    }

    leave(id: string): void {
        this.assertActive();
        this.players.delete(id);
        if (this.players.size === 0) this.clearEncounters();
    }

    update(delta: number, playable = true): void {
        this.assertActive();
        if (!Number.isFinite(delta) || delta < 0) throw new RangeError("Invalid adventure delta");
        this.playable = playable;
        if (!playable || this.players.size === 0) {
            this.clearEncounters();
            return;
        }
        this.elapsedMs += delta;
        const living = Array.from(this.players.values(), ({ player }) => player).filter(
            (player) => !player.IsDestroyed && player.HP > 0 && player.RespawnInMs === 0,
        );
        for (const defeat of this.pendingLoot.splice(0)) {
            this.createDrop(defeat, "xp", -12, 0);
            this.createDrop(defeat, "coin", 12, 0);
            if (defeat.heal) this.createDrop(defeat, "heal", 0, 20);
        }
        this.updateDrops(delta, living);
        // A large elapsed interval produces at most one encounter, never a burst
        // of missed waves after a pause or a temporarily empty party.
        if (living.length === 0) return;
        this.nextWaveInMs = Math.max(0, this.nextWaveInMs - delta);
        if (this.nextWaveInMs === 0) {
            this.wave = Math.min(1_000_000, this.wave + 1);
            this.spawnWave(living);
            this.nextWaveInMs = WAVE_INTERVAL_MS;
        }
    }

    state(): AdventureState {
        this.assertActive();
        return {
            round: this.round,
            wave: this.wave,
            nextWaveInMs: Math.ceil(this.nextWaveInMs),
            players: Array.from(this.players.values(), (progress) => ({
                id: progress.player.ID,
                level: progress.level,
                xp: progress.xp,
                xpToNext: xpRequired(progress.level),
                points: progress.points,
                coins: progress.coins,
                weapon: progress.weapon,
                upgrades: { ...progress.upgrades },
            })),
        };
    }

    chooseUpgrade(playerId: string, value: unknown): boolean {
        this.assertActive();
        const progress = this.players.get(playerId);
        if (
            !this.playable ||
            !progress ||
            !isUpgradeId(value) ||
            progress.points === 0 ||
            progress.upgrades[value] >= 5
        ) {
            return false;
        }
        progress.points--;
        progress.upgrades[value]++;
        this.applyBuild(progress);
        return true;
    }

    chooseWeapon(playerId: string, value: unknown): boolean {
        this.assertActive();
        const progress = this.players.get(playerId);
        if (!this.playable || !progress || !isWeaponId(value)) return false;
        const definition = WEAPONS.find((weapon) => weapon.id === value);
        if (!definition || progress.level < definition.unlockLevel || progress.weapon === value) return false;
        progress.weapon = value;
        this.applyBuild(progress);
        return true;
    }

    reset(): void {
        this.assertActive();
        this.clearEncounters();
        this.round = Math.min(1_000_000, this.round + 1);
        this.wave = 0;
        this.nextWaveInMs = FIRST_WAVE_MS;
        this.elapsedMs = 0;
        this.defeats = 0;
        this.playable = true;
        for (const [id, progress] of this.players) {
            const fresh = this.initialProgression(progress.player);
            this.players.set(id, fresh);
            this.applyBuild(fresh);
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.clearEncounters();
        this.unsubscribeObjects();
        this.players.clear();
        this.disposed = true;
    }

    private initialProgression(player: Player): Progression {
        return {
            player,
            level: 1,
            xp: 0,
            points: 0,
            coins: 0,
            weapon: "ember",
            upgrades: { power: 0, haste: 0, vitality: 0, stride: 0 },
        };
    }

    private applyBuild(progress: Progression): void {
        progress.player.applyAdventureBuild(createAdventureBuild(progress.weapon, progress.upgrades));
    }

    private spawnWave(living: readonly Player[]): void {
        const amount = Math.min(8, 3 + Math.floor((this.wave - 1) / 2), MAX_LIVE_WAVE_ENEMIES - this.waveEnemies.size);
        const { chunkSize, numOfChunksX, numOfChunksY } = this.core.Runtime.config;
        const width = chunkSize * numOfChunksX;
        const height = chunkSize * numOfChunksY;
        for (let index = 0; index < amount; index++) {
            const target = living[(this.wave + index - 1) % living.length];
            if (!target) continue;
            const angle = this.wave * 2.399963 + (index / Math.max(1, amount)) * Math.PI * 2;
            const radius = 330 + this.core.Runtime.random() * 100;
            const position: [number, number] = [
                Math.max(0, Math.min(width - 32, target.Transform.X + Math.cos(angle) * radius)),
                Math.max(0, Math.min(height - 32, target.Transform.Y + Math.sin(angle) * radius)),
            ];
            if (!this.core.ChunksManager.getChunkAtPosition(...position)?.IsActive) continue;
            this.core.ObjectsFactory.instantiateWithPosition(
                "Michau",
                position,
                undefined,
                undefined,
                undefined,
                (object) => {
                    if (!(object instanceof Enemy)) throw new Error("Adventure enemies require the Enemy prefab");
                    object.Name = ENEMY_NAMES[(this.wave + index - 1) % ENEMY_NAMES.length] ?? ENEMY_NAMES[0];
                    object.SpriteName = "wraith";
                    object.configureVitals(70);
                    object.setHomePosition(position);
                    this.waveEnemies.set(object.ID, object);
                },
            );
        }
    }

    private onDestroyed(object: GameObject): void {
        if (object instanceof FireBall) this.waveProjectiles.delete(object);
        this.drops.delete(object.ID);
        this.waveEnemies.delete(object.ID);
        if (
            this.suppressRewards ||
            !this.playable ||
            this.players.size === 0 ||
            !(object instanceof Enemy) ||
            object.HP > 0 ||
            this.rewarded.has(object)
        )
            return;
        this.rewarded.add(object);
        this.defeats++;
        // Object destruction can occur while a chunk is building its dump.
        // Publish loot on the next controller update, after that transaction,
        // so a new pickup cannot accidentally enter a sleeping chunk's dump.
        if (this.pendingLoot.length < MAX_DROPS) {
            this.pendingLoot.push({ x: object.Transform.X, y: object.Transform.Y, heal: this.defeats % 5 === 0 });
        }
    }

    private createDrop(
        source: { readonly x: number; readonly y: number },
        kind: LootKind,
        offsetX: number,
        offsetY: number,
    ): void {
        const size = kind === "heal" ? 22 : kind === "xp" ? 18 : 16;
        const { chunkSize, numOfChunksX, numOfChunksY } = this.core.Runtime.config;
        const x = Math.max(0, Math.min(chunkSize * numOfChunksX - size, source.x + offsetX));
        const y = Math.max(0, Math.min(chunkSize * numOfChunksY - size, source.y + offsetY));
        if (!this.core.ChunksManager.getChunkAtPosition(x, y)?.IsActive) return;
        if (this.drops.size >= MAX_DROPS) {
            const oldest = this.drops.values().next().value as Loot | undefined;
            oldest?.object.destroy();
        }
        this.core.ObjectsFactory.instantiateWithPosition(
            "ExpeditionMarker",
            [x, y],
            size,
            undefined,
            undefined,
            (object) => {
                if (!(object instanceof ExpeditionMarker)) throw new Error("Adventure loot requires the marker prefab");
                object.configureLoot();
                object.SpriteName = `loot_${kind}`;
                this.drops.set(object.ID, { object, kind, expiresAt: this.elapsedMs + LOOT_TTL_MS });
            },
        );
    }

    private updateDrops(delta: number, living: readonly Player[]): void {
        for (const loot of this.drops.values()) {
            if (loot.object.IsDestroyed || this.elapsedMs >= loot.expiresAt) {
                loot.object.destroy();
                continue;
            }
            let target: Player | undefined;
            let distanceSquared = MAGNET_RADIUS * MAGNET_RADIUS;
            for (const player of living) {
                if (loot.kind === "heal" && player.HP === player.MaxHP) continue;
                const dx = player.Transform.X - loot.object.Transform.X;
                const dy = player.Transform.Y - loot.object.Transform.Y;
                const squared = dx * dx + dy * dy;
                if (squared <= distanceSquared) {
                    target = player;
                    distanceSquared = squared;
                }
            }
            if (!target) continue;
            if (distanceSquared <= PICKUP_RADIUS * PICKUP_RADIUS) {
                // Remove before awarding so simultaneous collectors and callbacks
                // can never claim the same ground drop twice.
                this.drops.delete(loot.object.ID);
                loot.object.destroy();
                if (loot.kind === "xp") this.awardExperience(10);
                else if (loot.kind === "coin") {
                    for (const progress of this.players.values())
                        progress.coins = Math.min(1_000_000_000, progress.coins + 1);
                } else target.heal(45);
                continue;
            }
            const distance = Math.sqrt(distanceSquared);
            const movement = Math.min(distance - PICKUP_RADIUS, delta * 0.32);
            if (movement <= 0) continue;
            loot.object.Transform.X += ((target.Transform.X - loot.object.Transform.X) / distance) * movement;
            loot.object.Transform.Y += ((target.Transform.Y - loot.object.Transform.Y) / distance) * movement;
            loot.object.updateColliders();
            this.core.ChunksManager.rebuildOne(loot.object);
        }
    }

    private awardExperience(amount: number): void {
        for (const progress of this.players.values()) {
            if (progress.level === ADVENTURE_MAX_LEVEL) continue;
            progress.xp += amount;
            while (progress.level < ADVENTURE_MAX_LEVEL && progress.xp >= xpRequired(progress.level)) {
                progress.xp -= xpRequired(progress.level);
                progress.level++;
                progress.points++;
            }
            if (progress.level === ADVENTURE_MAX_LEVEL) progress.xp = 0;
        }
    }

    private clearEncounters(): void {
        this.suppressRewards = true;
        try {
            for (const enemy of this.waveEnemies.values()) enemy.destroy();
            for (const projectile of this.waveProjectiles) projectile.destroy();
            for (const loot of this.drops.values()) loot.object.destroy();
            this.waveEnemies.clear();
            this.waveProjectiles.clear();
            this.drops.clear();
            this.pendingLoot.length = 0;
        } finally {
            this.suppressRewards = false;
        }
    }

    private assertActive(): void {
        if (this.disposed) throw new Error("Adventure is disposed");
    }
}
