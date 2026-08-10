import {GameObject} from "./game_utils/game/objects/GameObject";
import {CollisionsSystem} from "./game_utils/physics/CollisionsSystem";
import {ChunksManager} from "./chunks/ChunksManager";
import {Chunk} from "./chunks/Chunk";
import {SharedConfig} from "./SharedConfig";

export class GameWorld {
    private collisionsSystem: CollisionsSystem = new CollisionsSystem();
    private chunksManager: ChunksManager = null;

    constructor(chunksManager: ChunksManager) {
        this.chunksManager = chunksManager;
    }

    public update(delta: number) {
        let chunk: Chunk;

        for (chunk of this.chunksManager.ChunksIterator()) {
            for (let i = 0; i < chunk.Objects.length; i++) {
                chunk.Objects[i].update(delta);
            }
        }

        this.collisionsSystem.update();
        for (chunk of this.chunksManager.ChunksIterator()) {
            this.collisionsSystem.updateCollisions(chunk.Objects);
        }

        if(SharedConfig.IS_SERVER) {
            this.chunksManager.deactivateUnusedChunks();
        }

        this.chunksManager.rebuild();
    }

    public addObject(gameObject: GameObject) {
        if(gameObject.IsDestroyed) {
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
