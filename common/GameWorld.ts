import {GameObject} from "./game_utils/game/GameObject";
import {GameObjectsSubscriber} from "./game_utils/factory/GameObjectsSubscriber";
import {CollisionsSystem} from "./game_utils/physics/CollisionsSystem";
import {ChunksManager} from "./game_utils/Chunks";

export class GameWorld extends GameObjectsSubscriber {
    private collistionsSystem: CollisionsSystem = new CollisionsSystem();
    private chunksManager: ChunksManager;

    constructor() {
        super();
        this.chunksManager = new ChunksManager();

        console.log("create game instance");
    }

    public update(delta: number) {
        const maxDelta: number = 40;
        const maxDeltaLoops: number = 3;

        let loops: number = 0;
        while(delta > 0 && loops < maxDeltaLoops) {
            let loopDelta: number = maxDelta < delta ? maxDelta : delta;
            this.GameObjectsMapById.forEach((object: GameObject) => {
                object.update(loopDelta);
            });

            this.collistionsSystem.updateCollisions(this.GameObjectsMapById);
            delta -= maxDelta;
            loops++;
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

    deserialize(world: string) {

    }
}
