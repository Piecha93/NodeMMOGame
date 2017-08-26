import {GameObject} from "./utils/game/GameObject";
import {GameObjectsHolder} from "./utils/game/GameObjectsHolder";
import {Bodies, Composites, Engine, IRunnerOptions, Runner, World, Body, Events} from "matter-js";
import {CommonConfig, Origin} from "../Common/CommonConfig";

export class GameWorld extends GameObjectsHolder {
    private height: number;
    private width: number;

    private engine: Engine;
    private world: World;

    constructor(width: number, height: number) {
        super();

        this.width = width;
        this.height = height;
        console.log("create game instance");

        this.initPhysics();
    }

    private initPhysics() {
        this.engine = Engine.create({});
        this.world = this.engine.world;
        this.world.gravity.scale = 0.0005;
    }

    public update(delta: number) {
        this.gameObjectsMapById.forEach((object: GameObject) => {
            object.update(delta);
        });

        if(CommonConfig.ORIGIN == Origin.SERVER)
            Engine.update(this.engine, delta);

        // Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp });
        // Engine.update(this.engine, delta);
        // Events.trigger(this.engine, 'afterTick', { timestamp: this.engine.timing.timestamp });

      //  if(CommonConfig.ORIGIN == Origin.SERVER) {
      //       this.spacialGrid.rebuildGrid();
      //       this.spacialGrid.checkCollisions();
        //}
    }

    public addGameObject(gameObject: GameObject) {
        World.add(this.world, gameObject.Transform.Body);
        super.addGameObject(gameObject);
    }

    public removeGameObject(gameObject: GameObject) {
        World.remove(this.world, gameObject.Transform.Body);
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
