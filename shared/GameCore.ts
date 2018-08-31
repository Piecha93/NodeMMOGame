import {GameWorld} from "./GameWorld";
import {ChunksManager} from "./chunks/ChunksManager";
import {UpdateCollector} from "./serialize/UpdateCollector";
import {DeltaTimer} from "./utils/DeltaTimer";
import {Chunk} from "./chunks/Chunk";
import {CollisionsSystem} from "./game_utils/physics/CollisionsSystem";

export class GameCore {
    private world: GameWorld = null;
    private chunksManager: ChunksManager = null;
    private updateCollector: UpdateCollector = null;
    private deltaTimer: DeltaTimer = null;

    constructor() {
        this.chunksManager = new ChunksManager();
        this.updateCollector = new UpdateCollector(this.chunksManager);
        this.world = new GameWorld(this.chunksManager);
        this.deltaTimer = new DeltaTimer();
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

    get ChunksManager(): ChunksManager {
        return this.chunksManager;
    }

    get CollisionsSystem(): CollisionsSystem {
        return this.world.CollisionsSystem;
    }
}