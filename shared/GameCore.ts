import { WorldContext, WorldOptions } from "./core/WorldContext";
import { SharedConfig } from "./SharedConfig";
import { PrefabCatalog } from "./game_utils/factory/GameObjectPrefabs";
import { createDefaultPrefabCatalog } from "./game_utils/factory/RegisterGameObjectPrefabs";
import { GameWorld } from "./GameWorld";
import { ChunksManager } from "./chunks/ChunksManager";
import { UpdateCollector } from "./serialize/UpdateCollector";

import { Chunk } from "./chunks/Chunk";
import { CollisionsSystem } from "./game_utils/physics/CollisionsSystem";
import { GameObject } from "./game_utils/game/objects/GameObject";
import { GameObjectsManager } from "./game_utils/factory/GameObjectsManager";
import { GameObjectsFactory } from "./game_utils/factory/ObjectsFactory";

export class GameCore {
    private world: GameWorld;
    private chunksManager: ChunksManager;
    private updateCollector: UpdateCollector;

    private objectsManager: GameObjectsManager;
    private objectsFactory: GameObjectsFactory;
    private unsubscribeObjects: () => void;
    private disposed: boolean = false;

    public readonly Runtime: WorldContext;
    private accumulator = 0;
    private lastClock: number;
    private readonly beforeStep = new Set<(tick: number, delta: number) => void>();
    public droppedTimeMs = 0;

    constructor(options: WorldOptions & { prefabs?: PrefabCatalog } = {}) {
        this.Runtime = new WorldContext({
            role: SharedConfig.ORIGIN,
            chunkSize: SharedConfig.chunkSize,
            numOfChunksX: SharedConfig.numOfChunksX,
            numOfChunksY: SharedConfig.numOfChunksY,
            chunkDeactivationTime: SharedConfig.chunkDeactivationTime,
            ...options,
        });
        this.lastClock = this.Runtime.clock();
        this.objectsManager = new GameObjectsManager();
        this.objectsFactory = new GameObjectsFactory(
            this.objectsManager,
            this.Runtime,
            options.prefabs ?? createDefaultPrefabCatalog(),
        );
        this.chunksManager = new ChunksManager(this.objectsManager, this.objectsFactory);
        this.updateCollector = new UpdateCollector(this.chunksManager, this.objectsManager, this.objectsFactory);
        this.world = new GameWorld(this.chunksManager);

        this.unsubscribeObjects = this.objectsManager.subscribe({
            created: (gameObject: GameObject) => this.onObjectCreated(gameObject),
            destroyed: (gameObject: GameObject) => this.onObjectDestroyed(gameObject),
        });
    }

    private onObjectCreated(gameObject: GameObject) {
        this.chunksManager.addObject(gameObject);
        if (gameObject.IsDestroyed) {
            return;
        }

        this.world.addObject(gameObject);
        if (gameObject.IsDestroyed) {
            return;
        }

        this.updateCollector.recordCreated(gameObject);
    }

    private onObjectDestroyed(gameObject: GameObject) {
        const oldChunk = this.chunksManager.removeAndReturnOldChunk(gameObject);
        this.world.removeObject(gameObject);
        this.updateCollector.recordDestroyed(gameObject, oldChunk);
    }

    subscribeBeforeStep(listener: (tick: number, delta: number) => void): () => void {
        this.beforeStep.add(listener);
        return () => this.beforeStep.delete(listener);
    }

    step(delta: number = this.Runtime.config.fixedDeltaMs): void {
        if (this.disposed) throw new Error("World is disposed");
        if (!Number.isFinite(delta) || delta <= 0) throw new RangeError("Invalid simulation delta");
        for (const listener of this.beforeStep) listener(this.Runtime.tick, delta);
        this.world.update(delta);
        this.Runtime.tick = (this.Runtime.tick + 1) >>> 0;
        this.Runtime.timeMs += delta;
    }

    advance(elapsedMs: number): number {
        if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError("Invalid elapsed time");
        const { fixedDeltaMs, maxCatchUpSteps } = this.Runtime.config;
        this.accumulator += elapsedMs;
        const maxBacklog = fixedDeltaMs * maxCatchUpSteps;
        if (this.accumulator > maxBacklog) {
            this.droppedTimeMs += this.accumulator - maxBacklog;
            this.accumulator = maxBacklog;
        }
        let steps = 0;
        while (this.accumulator + 1e-9 >= fixedDeltaMs && steps < maxCatchUpSteps) {
            this.step();
            this.accumulator -= fixedDeltaMs;
            steps++;
        }
        return steps;
    }

    gameLoop(): number {
        const now = this.Runtime.clock();
        const elapsed = Math.max(0, now - this.lastClock);
        this.lastClock = now;
        return this.advance(elapsed);
    }

    collectUpdateFrames(): Map<Chunk, ArrayBuffer[]> {
        return this.updateCollector.collectUpdateFrames();
    }

    decodeUpdateFrames(frames: readonly ArrayBuffer[]): void {
        this.updateCollector.decodeUpdateFrames(frames);
    }

    collectUpdate(): Map<Chunk, ArrayBuffer> {
        return this.updateCollector.collectUpdate();
    }

    decodeUpdate(updateBuffer: ArrayBuffer) {
        this.updateCollector.decodeUpdate(updateBuffer);
    }

    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.beforeStep.clear();

        try {
            this.objectsManager.dispose();
        } finally {
            this.unsubscribeObjects();
        }
    }

    get ChunksManager(): ChunksManager {
        return this.chunksManager;
    }

    get CollisionsSystem(): CollisionsSystem {
        return this.world.CollisionsSystem;
    }

    get ObjectsManager(): GameObjectsManager {
        return this.objectsManager;
    }

    get ObjectsFactory(): GameObjectsFactory {
        return this.objectsFactory;
    }
}
