import {GameObject} from "./game_utils/game/objects/GameObject";
import {GameObjectsSubscriber} from "./game_utils/factory/GameObjectsSubscriber";
import {CollisionsSystem} from "./game_utils/physics/CollisionsSystem";
import {Map} from "./game_utils/Map";
import {ChunksManager} from "./game_utils/chunks/ChunksManager";
import {Chunk} from "./game_utils/chunks/Chunk";
import {SharedConfig} from ".//SharedConfig";

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
            let chunk: Chunk;

            let chunksIter = this.chunksManager.ChunksIterator();
            while(chunk = chunksIter.next().value) {
                for (let i = 0; i < chunk.Objects.length; i++) {
                    chunk.Objects[i].update(delta);
                }
            }

            chunksIter = this.chunksManager.ChunksIterator();
            this.collistionsSystem.update();
            while(chunk = chunksIter.next().value) {
                this.collistionsSystem.updateCollisions(chunk.Objects);
                if(!chunk.IsDeactivateTimePassed && !chunk.IsActive &&SharedConfig.IS_SERVER) {
                    chunk.dumpToMemory();
                }
            }

            this.chunksManager.rebuild();
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