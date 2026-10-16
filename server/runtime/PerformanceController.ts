import { performance } from "node:perf_hooks";
import { GameCore } from "../../shared/GameCore";
import {
    PerformanceConfiguration,
    PerformanceState,
    validatePerformanceConfiguration,
} from "../../shared/gameplay/Performance";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";

/** Owns a bounded test population; it never mutates the expedition world. */
export class PerformanceController {
    private configuration: PerformanceConfiguration = { count: 0, distribution: "nearby", scenario: "moving" };
    private readonly enemies = new Set<string>();
    private readonly players = new Set<Player>();
    private positions: Array<[number, number]> = [];
    private spawned = 0;
    private readonly tickSamples: number[] = [];
    private tickStarted = 0;
    private readonly unsubscribeBefore: () => void;
    private readonly unsubscribeAfter: () => void;
    private readonly unsubscribeObjects: () => void;

    constructor(private readonly core: GameCore) {
        if (!core.Runtime.config.performanceMode) throw new Error("Performance controller requires a dedicated world");
        this.unsubscribeBefore = core.subscribeBeforeStep(() => {
            this.tickStarted = performance.now();
            this.updatePopulation();
            // This world intentionally simulates distant entities too. Keeping the
            // chunks alive makes a world-wide test repeatable beyond the first second.
            for (const chunk of core.ChunksManager.ChunksIterator()) chunk.activate();
        });
        this.unsubscribeAfter = core.subscribeAfterStep(() => {
            this.tickSamples.push(performance.now() - this.tickStarted);
            if (this.tickSamples.length > 256) this.tickSamples.shift();
        });
        this.unsubscribeObjects = core.ObjectsManager.subscribe({
            created: (object) => {
                if (object instanceof Player) this.players.add(object);
            },
            destroyed: (object) => {
                this.enemies.delete(object.ID);
                if (object instanceof Player) this.players.delete(object);
            },
        });
    }

    spawnPosition(): [number, number] {
        const config = this.core.Runtime.config;
        return [
            Math.floor(config.numOfChunksX / 2) * config.chunkSize + config.chunkSize / 2,
            Math.floor(config.numOfChunksY / 2) * config.chunkSize + config.chunkSize / 2,
        ];
    }

    configure(value: unknown, center: readonly [number, number] = this.spawnPosition()): void {
        const configuration = validatePerformanceConfiguration(value);
        this.clearPopulation();
        this.configuration = configuration;
        this.tickSamples.length = 0;
        this.positions = this.createPositions(configuration, center);
    }

    private clearPopulation(): void {
        this.positions = [];
        this.spawned = 0;
        const owned = new Set(this.enemies);
        for (const object of Array.from(this.core.ObjectsManager.ObjectsById.values())) {
            if (owned.has(object.ID) || object instanceof FireBall) object.destroy();
        }
        this.enemies.clear();
    }

    private createPositions(
        configuration: PerformanceConfiguration,
        center: readonly [number, number],
    ): Array<[number, number]> {
        const result: Array<[number, number]> = [];
        const { chunkSize, numOfChunksX, numOfChunksY } = this.core.Runtime.config;
        const columns = Math.ceil(Math.sqrt(configuration.count));
        const nearbyWidth = Math.max(0, columns - 1) * 40;
        const originX = Math.min(
            Math.max(center[0] - nearbyWidth / 2, 64),
            numOfChunksX * chunkSize - nearbyWidth - 64,
        );
        const originY = Math.min(
            Math.max(center[1] - nearbyWidth / 2, 64),
            numOfChunksY * chunkSize - nearbyWidth - 64,
        );
        const chunks = Array.from(this.core.ChunksManager.ChunksIterator());
        const perChunk = Math.ceil(configuration.count / Math.max(chunks.length, 1));
        const perChunkColumns = Math.ceil(Math.sqrt(perChunk));
        for (let index = 0; index < configuration.count; index++) {
            if (configuration.distribution === "nearby") {
                result.push([originX + (index % columns) * 40, originY + Math.floor(index / columns) * 40]);
            } else {
                const chunk = chunks[index % chunks.length];
                if (!chunk) break;
                const slot = Math.floor(index / chunks.length);
                const [x, y] = chunk.Position;
                // Odd columns use a half-height offset in the existing hex grid.
                const offsetY = x % 2 && y > 0 ? chunkSize / 2 : 0;
                result.push([
                    x * chunkSize + 80 + (slot % perChunkColumns) * 48,
                    y * chunkSize + offsetY + 80 + Math.floor(slot / perChunkColumns) * 48,
                ]);
            }
        }
        return result;
    }

    private updatePopulation(): void {
        for (let batch = 0; batch < 80 && this.spawned < this.positions.length; batch++) {
            const index = this.spawned++;
            const position = this.positions[index];
            if (!position) continue;
            this.core.ChunksManager.getChunkAtPosition(...position)?.activate();
            const object = this.core.ObjectsFactory.instantiateWithPosition(
                "Michau",
                position,
                undefined,
                undefined,
                undefined,
                (entity) => {
                    if (!(entity instanceof Enemy)) throw new Error("Performance prefab must be an enemy");
                    entity.Name = "";
                    entity.setHomePosition(position);
                    entity.configurePerformance(
                        this.configuration.scenario,
                        (index * 0.61803398875) % 1,
                        () => this.players,
                    );
                },
            );
            if (!object.IsDestroyed) this.enemies.add(object.ID);
        }
    }

    state(snapshotBytesPerSecond = 0): PerformanceState {
        const sorted = [...this.tickSamples].sort((a, b) => a - b);
        const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
        const chunks = Array.from(this.core.ChunksManager.ChunksIterator());
        return {
            ...this.configuration,
            enemies: this.enemies.size,
            pending: this.positions.length - this.spawned,
            objects: this.core.ObjectsManager.ObjectsById.size,
            activeChunks: chunks.filter((chunk) => chunk.IsActive).length,
            totalChunks: chunks.length,
            serverTick: this.core.Runtime.tick,
            tickP50Ms: percentile(0.5),
            tickP95Ms: percentile(0.95),
            tickSamples: sorted.length,
            tickBudgetMs: this.core.Runtime.config.fixedDeltaMs,
            droppedTimeMs: this.core.droppedTimeMs,
            snapshotBytesPerSecond,
        };
    }

    dispose(): void {
        this.unsubscribeBefore();
        this.unsubscribeAfter();
        this.unsubscribeObjects();
        this.clearPopulation();
        this.players.clear();
        this.tickSamples.length = 0;
    }
}
