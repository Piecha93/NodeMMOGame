import {GameObject} from "./utils/game/GameObject";
import {GameObjectsSubscriber} from "./utils/factory/GameObjectsSubscriber";
import {CollisionsSystem} from "./utils/physics/CollisionsSystem";
import {ChunksManager} from "../common/utils/Chunks";

export class GameWorld extends GameObjectsSubscriber {
    private collistionsSystem: CollisionsSystem = new CollisionsSystem();
    private chunksManager: ChunksManager;

    constructor() {
        super();
        this.chunksManager = new ChunksManager();

        console.log("create game instance");
    }

    public update(delta: number) {
        const maxDelta = 40;
        const maxDeltaLoops = 3;

        let loops: number = 0;
        while(delta > 0 && loops < maxDeltaLoops) {
            this.GameObjectsMapById.forEach((object: GameObject) => {
                object.update(delta % maxDelta);
            });

            this.collistionsSystem.updateCollisions(this.GameObjectsMapById);
            delta -= maxDelta;
            loops++;
        }

        if(delta > 0) {
            console.log("lost ms " + delta);
        }

        this.chunksManager.rebuild(this.GameObjectsMapById);
    }

    public onObjectCreate(gameObject: GameObject) {
        this.collistionsSystem.insertObject(gameObject);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.collistionsSystem.removeObject(gameObject);

        this.chunksManager.remove(gameObject);
    }

    get CollisionsSystem(): CollisionsSystem {
        return this.collistionsSystem;
    }

    get ChunksManager(): ChunksManager {
        return this.chunksManager;
    }

    deserialize(world: string) {

    }

    // serialize(): string {
    //     return this.width.toString() + ',' + this.height.toString();
    // }
}
