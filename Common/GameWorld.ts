import {GameObject} from "./utils/game/GameObject";
import {GameObjectsSubscriber} from "./utils/game/GameObjectsSubscriber";
import {SpatialGrid} from "./utils/physics/SpatialGrid";

export class GameWorld extends GameObjectsSubscriber {
    private spatialGrid: SpatialGrid;

    private height: number;
    private width: number;

    constructor(width: number, height: number) {
        super();
        this.width = width;
        this.height = height;
        this.spatialGrid = new SpatialGrid(this.width, this.height, 90);
        console.log("create game instance");
    }

    public update(delta: number) {
        this.GameObjectsMapById.forEach((object: GameObject) => {
            object.update(delta);
        });

        this.spatialGrid.rebuildGrid();
        this.spatialGrid.checkCollisions();
    }

    public onObjectCreate(gameObject: GameObject) {
        this.spatialGrid.addObject(gameObject);
        // super.addGameObject(gameObject);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.spatialGrid.removeObject(gameObject);
        // super.removeGameObject(gameObject);
    }

    get SpatialGrid(): SpatialGrid {
        return this.spatialGrid;
    }

    get Width(): number {
        return this.width;
    }

    get Height(): number {
        return this.height;
    }

    deserialize(world: string) {

    }

    serialize(): string {
        return this.width.toString() + ',' + this.height.toString();
    }
}
