import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {CommonConfig, Origin} from "../../CommonConfig";
import {Collidable} from "../physics/Collidable";
import {NetworkObject, NetworkProperty} from "../../serialize/NetworkDecorators";
import {Serializable} from "../../serialize/Serializable";


export abstract class GameObject extends Serializable implements Collidable {
    protected id: string = "";
    @NetworkProperty(ChangesDict.SPRITE_NAME)
    protected spriteName: string;
    @NetworkObject("t1")
    protected transform: Transform;

    @NetworkProperty(ChangesDict.VELOCITY)
    protected velocity: number = 10;

    private destroyListeners: Set<Function>;

    constructor(transform: Transform) {
        super();
        this.transform = transform;

        this.spriteName = "none";
        this.destroyListeners = new Set<Function>();
    }

    onCollisionEnter(gameObject: GameObject, response: SAT.Response) {
        if(CommonConfig.ORIGIN == Origin.SERVER) {
            this.serverCollision(gameObject, response);
        }
        this.commonCollision(gameObject, response);
    }

    protected serverCollision(gameObject: GameObject, response: SAT.Response) {

    }

    protected commonCollision(gameObject: GameObject, response: SAT.Response) {

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

    set ID(id: string) {
        this.id = id;
    }

    get SpriteName(): string {
        return this.spriteName;
    }

    set SpriteName(spriteName: string) {
        this.spriteName = spriteName;
        this.changes.add(ChangesDict.SPRITE_NAME);
    }
}