import {GameObject} from "./utils/game/GameObject";
import {GameObjectsHolder} from "./utils/game/GameObjectsHolder";
import {CommonConfig, Origin} from "../Common/CommonConfig";
import {World} from "p2";

export class GameWorld extends GameObjectsHolder {
    private height: number;
    private width: number;

    private world: World;

    constructor(width: number, height: number) {
        super();

        this.width = width;
        this.height = height;
        console.log("create game instance");

        this.initPhysics();
    }

    private initPhysics() {
        this.world = new World();
        this.world.gravity = [0, 9.81];
    }

    public update(delta: number) {
        this.gameObjectsMapById.forEach((object: GameObject) => {
            object.update(delta);
        });
        console.log(delta / 1000 + " " + 1/30*10);
        if(CommonConfig.ORIGIN == Origin.SERVER)
            this.world.step(1 / 30, delta / 1000, 10);
    }

    public addGameObject(gameObject: GameObject) {
        this.world.addBody(gameObject.Transform.Body);
        super.addGameObject(gameObject);
    }

    public removeGameObject(gameObject: GameObject) {
        this.world.removeBody(gameObject.Transform.Body);
        super.removeGameObject(gameObject);
    }

    // get SpacialGrid(): SpacialGrid {
    //     return this.spacialGrid;
    // }

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
