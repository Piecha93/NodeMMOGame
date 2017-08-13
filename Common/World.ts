import {GameObject} from "./utils/game/GameObject";
import {GameObjectsHolder} from "./utils/game/GameObjectsHolder";
import {Cell, SpacialGrid} from "./utils/physics/SpacialGrid";
import {CommonConfig, Origin} from "../Common/CommonConfig";

export class World extends GameObjectsHolder {
    private spacialGrid: SpacialGrid;

    private height: number;
    private width: number;

    constructor(width: number, height: number) {
        super();
        this.width = width;
        this.height = height;
        this.spacialGrid = new SpacialGrid(this.width, this.height, 90);
        console.log("create game instance");
    }

    public update(delta: number) {
        this.gameObjectsMapById.forEach((object: GameObject) => {
            object.update(delta);
        });

      //  if(CommonConfig.ORIGIN == Origin.SERVER) {
            this.spacialGrid.rebuildGrid();
            this.spacialGrid.checkCollisions();
        //}
    }

    public addGameObject(gameObject: GameObject) {
        this.spacialGrid.addObject(gameObject);
        super.addGameObject(gameObject);
    }

    public removeGameObject(gameObject: GameObject) {
        this.spacialGrid.removeObject(gameObject);
        super.removeGameObject(gameObject);
    }

    //TEST
    get Cells(): Array<Cell> {
        return this.spacialGrid.Cells;
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
