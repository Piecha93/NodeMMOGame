import {GameObject} from "./utils/game/GameObject";
import {GameObjectsSubscriber} from "./utils/factory/GameObjectsSubscriber";
import {CollisionsSystem} from "./utils/physics/CollisionsSystem";

export class GameWorld extends GameObjectsSubscriber {
    private collistionsSystem: CollisionsSystem = new CollisionsSystem();

    // private width: number;
    // private height: number;

    constructor() {
        super();
        // this.width = width;
        // this.height = height;
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
    }


    public onObjectCreate(gameObject: GameObject) {
        this.collistionsSystem.insertObject(gameObject);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.collistionsSystem.removeObject(gameObject);
    }

    // get Width(): number {
    //     return this.width;
    // }
    //
    // get Height(): number {
    //     return this.height;
    // }

    get CollisionsSystem(): CollisionsSystem {
        return this.collistionsSystem;
    }

    deserialize(world: string) {

    }

    // serialize(): string {
    //     return this.width.toString() + ',' + this.height.toString();
    // }
}
