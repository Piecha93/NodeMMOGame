import {GameObject} from "./game_utils/game/objects/GameObject";
import {GameObjectsSubscriber} from "./game_utils/factory/GameObjectsSubscriber";
import {CollisionsSystem} from "./game_utils/physics/CollisionsSystem";
import {Map} from "./game_utils/Map";
import {ChunksManager} from "./game_utils/chunks/ChunksManager";
import {Chunk} from "./game_utils/chunks/Chunk";
import {CommonConfig} from "../common/CommonConfig";

export class GameWorld extends GameObjectsSubscriber {
    private collistionsSystem: CollisionsSystem = new CollisionsSystem();
    private chunksManager: ChunksManager = null;
    // private map: Map = new Map();

    constructor(chunksManager: ChunksManager) {
        super();

        this.chunksManager = chunksManager;
        console.log("create game instance");
    }

    public update(delta: number) {
        const maxDelta: number = 40;
        const maxDeltaLoops: number = 3;

        let loops: number = 0;
        while(delta > 0 && loops < maxDeltaLoops) {
            let chunk: Chunk;
            let loopDelta: number = maxDelta < delta ? maxDelta : delta;

            let chunksIter = this.chunksManager.ChunksIterator();
            while(chunk = chunksIter.next().value) {
                for (let i = 0; i < chunk.Objects.length; i++) {
                    chunk.Objects[i].update(loopDelta);
                }
            }

            chunksIter = this.chunksManager.ChunksIterator();
            this.collistionsSystem.update();
            while(chunk = chunksIter.next().value) {
                this.collistionsSystem.updateCollisions(chunk.Objects);
                if(!chunk.IsActive && CommonConfig.IS_SERVER) {
                    chunk.dump();
                }
            }
            delta -= maxDelta;
            loops++;

            this.chunksManager.rebuild();
        }

        if(delta > 0) {
            console.log("lost ms " + delta);
        }
    }

    public onObjectCreate(gameObject: GameObject) {
        this.collistionsSystem.insertObject(gameObject);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.collistionsSystem.removeObject(gameObject);
    }

    get CollisionsSystem(): CollisionsSystem {
        return this.collistionsSystem;
    }
}
