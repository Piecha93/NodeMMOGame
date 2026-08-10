import {GameWorld} from "./GameWorld";
import {ChunksManager} from "./chunks/ChunksManager";
import {UpdateCollector} from "./serialize/UpdateCollector";
import {DeltaTimer} from "./utils/DeltaTimer";
import {Chunk} from "./chunks/Chunk";
import {CollisionsSystem} from "./game_utils/physics/CollisionsSystem";
import {GameObject} from "./game_utils/game/objects/GameObject";
import {GameObjectsManager} from "./game_utils/factory/GameObjectsManager";
import {GameObjectsFactory} from "./game_utils/factory/ObjectsFactory";

export class GameCore {
    private world: GameWorld = null;
    private chunksManager: ChunksManager = null;
    private updateCollector: UpdateCollector = null;
    private deltaTimer: DeltaTimer = null;
    private objectsManager: GameObjectsManager = null;
    private objectsFactory: GameObjectsFactory = null;
    private unsubscribeObjects: (() => void) = null;
    private disposed: boolean = false;

    constructor() {
        this.objectsManager = new GameObjectsManager();
        this.objectsFactory = new GameObjectsFactory(this.objectsManager);
        this.chunksManager = new ChunksManager(this.objectsManager, this.objectsFactory);
        this.updateCollector = new UpdateCollector(
            this.chunksManager,
            this.objectsManager,
            this.objectsFactory
        );
        this.world = new GameWorld(this.chunksManager);
        this.deltaTimer = new DeltaTimer();
        this.unsubscribeObjects = this.objectsManager.subscribe({
            created: (gameObject: GameObject) => this.onObjectCreated(gameObject),
            destroyed: (gameObject: GameObject) => this.onObjectDestroyed(gameObject)
        });
    }

    private onObjectCreated(gameObject: GameObject) {
        this.chunksManager.addObject(gameObject);
        if(gameObject.IsDestroyed) {
            return;
        }

        this.world.addObject(gameObject);
        if(gameObject.IsDestroyed) {
            return;
        }

        this.updateCollector.recordCreated(gameObject);
    }

    private onObjectDestroyed(gameObject: GameObject) {
        const oldChunk: Chunk = this.chunksManager.removeAndReturnOldChunk(gameObject);
        this.world.removeObject(gameObject);
        this.updateCollector.recordDestroyed(gameObject, oldChunk);
    }

    gameLoop() {
        let delta: number = this.deltaTimer.getDelta();

        const maxDelta: number = 40;
        const maxDeltaLoops: number = 3;

        let loops: number = 0;
        while (delta > 0 && loops < maxDeltaLoops) {
            let loopDelta: number = maxDelta < delta ? maxDelta : delta;

            this.world.update(loopDelta);

            delta -= maxDelta;
            loops++;
        }

        if (delta > 0) {
            console.log("Warrning! Lost " + delta + "ms");
        }
    }

    collectUpdate(): Map<Chunk, ArrayBuffer> {
        return this.updateCollector.collectUpdate();
    }

    decodeUpdate(updateBuffer: ArrayBuffer) {
        this.updateCollector.decodeUpdate(updateBuffer);
    }

    dispose() {
        if(this.disposed) {
            return;
        }
        this.disposed = true;

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
