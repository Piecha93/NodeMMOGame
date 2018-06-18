import {GameObject} from "./utils/game/GameObject";
import {GameObjectsSubscriber} from "./utils/game/GameObjectsSubscriber";
import {CollisionsSystem} from "./utils/physics/CollisionsSystem";

export class GameWorld extends GameObjectsSubscriber {
    private collistionsSystem: CollisionsSystem = new CollisionsSystem();

    private width: number;
    private height: number;

    constructor(width: number, height: number) {
        super();
        this.width = width;
        this.height = height;
        console.log("create game instance");
    }

    public update(delta: number) {
        if(delta > 40) {
            console.log("delta " + delta);
            delta = 40;
        }
        this.GameObjectsMapById.forEach((object: GameObject) => {
            object.update(delta);
        });

        this.collistionsSystem.updateCollisions(this.GameObjectsMapById);
    }


    public onObjectCreate(gameObject: GameObject) {
        this.collistionsSystem.insertObject(gameObject);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.collistionsSystem.removeObject(gameObject);
    }

    get Width(): number {
        return this.width;
    }

    get Height(): number {
        return this.height;
    }

    get CollisionsSystem(): CollisionsSystem {
        return this.collistionsSystem;
    }

    deserialize(world: string) {

    }

    serialize(): string {
        return this.width.toString() + ',' + this.height.toString();
    }
}
