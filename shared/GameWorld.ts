import { GameObject } from "./game_utils/game/objects/GameObject";
import { CollisionsSystem } from "./game_utils/physics/CollisionsSystem";
import { ChunksManager } from "./chunks/ChunksManager";
import { Chunk } from "./chunks/Chunk";

export class GameWorld {
    private collisionsSystem: CollisionsSystem = new CollisionsSystem();
    private chunksManager: ChunksManager;

    constructor(chunksManager: ChunksManager) {
        this.chunksManager = chunksManager;
    }

    public update(delta: number) {
        let chunk: Chunk;
        const objectsAtTickStart: GameObject[] = [];

        for (chunk of this.chunksManager.ChunksIterator()) {
            for (const gameObject of chunk.Objects) {
                objectsAtTickStart.push(gameObject);
            }
        }

        // Lifecycle callbacks can change chunk membership while objects update.
        // New objects begin updating next tick, even when spawned in a later chunk.
        for (const gameObject of objectsAtTickStart) {
            if (!gameObject.IsDestroyed) {
                gameObject.update(delta);
            }
        }

        this.collisionsSystem.update();
        for (chunk of this.chunksManager.ChunksIterator()) {
            this.collisionsSystem.updateCollisions(chunk.Objects);
        }

        if (this.chunksManager.Runtime.isServer) {
            this.chunksManager.deactivateUnusedChunks();
        }

        this.chunksManager.rebuild();

        // Collision callbacks and world bounds can correct transforms. Publish
        // final geometry before replication or another spatial query.
        for (chunk of this.chunksManager.ChunksIterator()) {
            for (const object of chunk.Objects) {
                if (!object.IsDestroyed) object.updateColliders();
            }
        }
        this.collisionsSystem.update();
    }

    public addObject(gameObject: GameObject) {
        if (gameObject.IsDestroyed) {
            return;
        }
        this.collisionsSystem.insertObject(gameObject);
    }

    public removeObject(gameObject: GameObject) {
        this.collisionsSystem.removeObject(gameObject);
    }

    get CollisionsSystem(): CollisionsSystem {
        return this.collisionsSystem;
    }
}
