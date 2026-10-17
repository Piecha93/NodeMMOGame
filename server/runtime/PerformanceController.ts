import { performance } from "node:perf_hooks";
import { GameCore } from "../../shared/GameCore";
import {
    PerformanceConfiguration,
    PerformanceState,
    PerformanceTelemetry,
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
        const positions = this.createPositions(configuration, center);
        this.clearPopulation();
        this.configuration = configuration;
        this.tickSamples.length = 0;
        this.positions = positions;
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
        if (configuration.count === 0) return result;
        if (!center.every(Number.isFinite)) throw new RangeError("Invalid performance population center");
        const { chunkSize, numOfChunksX, numOfChunksY } = this.core.Runtime.config;
        const worldWidth = numOfChunksX * chunkSize;
        const worldHeight = numOfChunksY * chunkSize;
        const margin = 64;
        const availableWidth = worldWidth - margin * 2;
        const availableHeight = worldHeight - margin * 2;
        const columns = Math.ceil(Math.sqrt(configuration.count));
        const nearbyWidth = Math.max(0, columns - 1) * 40;
        const rows = Math.ceil(configuration.count / columns);
        const nearbyHeight = Math.max(0, rows - 1) * 40;
        if (
            availableWidth < 0 ||
            availableHeight < 0 ||
            (configuration.distribution === "nearby" &&
                (nearbyWidth > availableWidth || nearbyHeight > availableHeight))
        )
            throw new RangeError("Performance population does not fit inside this world");
        const originX = Math.min(Math.max(center[0] - nearbyWidth / 2, margin), worldWidth - nearbyWidth - margin);
        const originY = Math.min(Math.max(center[1] - nearbyWidth / 2, margin), worldHeight - nearbyHeight - margin);
        if (configuration.distribution === "nearby") {
            for (let index = 0; index < configuration.count; index++)
                result.push([originX + (index % columns) * 40, originY + Math.floor(index / columns) * 40]);
            return result;
        }

        // Distribute a regular grid over the actual world rectangle. Odd chunk
        // columns have taller first and shorter last cells, so an equal fixed
        // number of 48 px slots per chunk cannot safely fit large populations.
        const worldColumns = Math.min(
            configuration.count,
            Math.ceil(Math.sqrt((configuration.count * availableWidth) / availableHeight)),
        );
        const worldRows = Math.ceil(configuration.count / worldColumns);
        const spacingX = worldColumns > 1 ? availableWidth / (worldColumns - 1) : availableWidth;
        const spacingY = worldRows > 1 ? availableHeight / (worldRows - 1) : availableHeight;
        if ((worldColumns > 1 && spacingX < 32) || (worldRows > 1 && spacingY < 32))
            throw new RangeError("Performance population does not fit inside this world");
        const buckets = new Map(
            Array.from(this.core.ChunksManager.ChunksIterator(), (chunk) => [chunk, [] as Array<[number, number]>]),
        );
        for (let index = 0; index < configuration.count; index++) {
            const position: [number, number] = [
                worldColumns > 1 ? margin + (index % worldColumns) * spacingX : worldWidth / 2,
                worldRows > 1 ? margin + Math.floor(index / worldColumns) * spacingY : worldHeight / 2,
            ];
            const chunk = this.core.ChunksManager.getChunkAtPosition(...position);
            const bucket = chunk && buckets.get(chunk);
            if (!bucket) throw new RangeError("Performance position lies outside the world");
            bucket.push(position);
        }
        // Preserve the loading behavior: each batch reaches distant chunks,
        // instead of filling one edge of the map before the others.
        for (let slot = 0; result.length < configuration.count; slot++)
            for (const bucket of buckets.values()) {
                const position = bucket[slot];
                if (position) result.push(position);
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

    get LastTickDurationMs(): number {
        return this.tickSamples.at(-1) ?? 0;
    }

    get EnemyCount(): number {
        return this.enemies.size;
    }

    state(
        snapshotBytesPerSecond = 0,
        telemetry: PerformanceTelemetry = { simulationHz: 0, snapshotHz: 0, snapshotP95Ms: 0 },
    ): PerformanceState {
        const sorted = [...this.tickSamples].sort((a, b) => a - b);
        const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
        const chunks = Array.from(this.core.ChunksManager.ChunksIterator());
        return {
            ...this.configuration,
            ...telemetry,
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
