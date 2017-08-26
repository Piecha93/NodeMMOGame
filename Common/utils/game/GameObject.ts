import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {CommonConfig, Origin} from "../../CommonConfig";
import {NetworkObject, NetworkProperty} from "../../serialize/NetworkDecorators";
import {Serializable} from "../../serialize/Serializable";
import {Bodies} from "matter-js";

export abstract class GameObject extends Serializable {
    protected id: string = "";
    @NetworkProperty(ChangesDict.SPRITE_NAME)
    protected spriteName: string;
    @NetworkObject("pos")
    protected transform: Transform;

    @NetworkProperty(ChangesDict.VELOCITY)
    protected velocity: number = 0;

    private destroyListeners: Set<Function>;

    // public spacialGridCells: Array<Cell> = [];

    constructor(transform?: Transform) {
        super();

        if(!transform) {
            transform = new Transform(Bodies.rectangle(0, 0, 32, 32));
        }

        this.transform = transform;

        this.spriteName = "none";
        this.destroyListeners = new Set<Function>();
    }

    // onCollisionEnter(gameObject: GameObject, response: SAT.Response) {
    //     if(CommonConfig.ORIGIN == Origin.SERVER) {
    //         this.serverCollision(gameObject, response);
    //     }
    //     this.commonCollision(gameObject, response);
    // }

    protected serverCollision(gameObject: GameObject) {
    }

    protected commonCollision(gameObject: GameObject) {
        // if(response.a == this.Transform.Polygon) {
        //     response.overlapV = response.overlapV.clone().reverse();
        // }
    }

    public forceCompleteUpdate() {
        this.forceComplete = true;
    }

    public update(delta: number) {
        if(CommonConfig.ORIGIN == Origin.SERVER) {
            this.serverUpdate(delta);
        }
        this.commonUpdate(delta);
    }

    protected commonUpdate(delta: number)  {
    }

    protected serverUpdate(delta: number)  {

    }

    addDestroyListener(listener: Function) {
        this.destroyListeners.add(listener)
    }

    removeDestroyListener(listener: Function) {
        this.destroyListeners.delete(listener);
    }

    destroy() {
        for(let listener of this.destroyListeners) {
            listener(this.id);
        }
        // console.log("Object destroyed " + this.ID);
    }

    get Transform(): Transform {
        return this.transform;
    }

    get ID(): string {
        return this.id;
    }

    get Velocity(): number {
        return this.velocity;
    }

    set Velocity(val: number) {
        this.velocity = val;
    }

    set ID(id: string) {
        this.id = id;
    }

    get SpriteName(): string {
        return this.spriteName;
    }

    set SpriteName(spriteName: string) {
        this.spriteName = spriteName;
        this.addChange(ChangesDict.SPRITE_NAME);
    }
}