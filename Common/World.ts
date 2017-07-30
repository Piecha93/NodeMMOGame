import {GameObject} from "./utils/game/GameObject";
import {GameObjectsHolder} from "./utils/game/GameObjectsHolder";
import {Transform} from "./utils/game/Transform";
import {CommonConfig, Origin} from "./CommonConfig";
import {Cell, SpacialGrid} from "./utils/physics/SpacialGrid";

export class World extends GameObjectsHolder {
    private tickrate: number = 30;
    private timeoutId: NodeJS.Timer;
    private spacialGrid: SpacialGrid;

    static HEIGHT: number = 1152 * 2;
    static WIDTH: number = 2048 * 2;

    // static HEIGHT: number = 576;
    // static WIDTH: number = 1024;

    constructor() {
        super();
        this.spacialGrid = new SpacialGrid(World.WIDTH, World.HEIGHT, 90);
        console.log("create game instance");
    }

    public update(delta: number) {
        this.gameObjectsMapById.forEach((object: GameObject) => {
            object.update(delta);
        });

        this.spacialGrid.rebuildGrid();
        if(CommonConfig.ORIGIN == Origin.SERVER) {
            this.spacialGrid.checkCollisions();
        }
    }

    public addGameObject(gameObject: GameObject) {
        this.spacialGrid.addObject(gameObject);
        super.addGameObject(gameObject);
    }

    public removeGameObject(gameObject: GameObject) {
        this.spacialGrid.removeObject(gameObject);
        super.removeGameObject(gameObject);
    }

    public stopGameLoop() {
        clearTimeout(this.timeoutId);
    }

    //TEST
    get Cells(): Array<Cell> {
        return this.spacialGrid.Cells;
    }
}
