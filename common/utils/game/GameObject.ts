import {Transform} from "../physics/Transform";
import {ChangesDict} from "../../serialize/ChangesDict";
import {CommonConfig} from "../../CommonConfig";
import {Serializable} from "../../serialize/Serializable";
import {NetworkObject, NetworkProperty} from "../../serialize/NetworkDecorators";
import {Result} from "detect-collisions";

import { Message, Type, Field, OneOf } from "protobufjs/light";

@Type.d("GameObjectMessage")
export class GameObject extends Message<GameObject> { //extends Serializable {
    @Field.d(1, "string", "required", "spriteName")
    protected id: string = "";
    // @NetworkProperty(ChangesDict.SPRITE_NAME)
    @Field.d(2, "string", "optional", "spriteName")
    protected spriteName: string;
    // @NetworkObject("pos")
    @Field.d(3, Transform)
    protected transform: Transform;

    // @NetworkProperty(ChangesDict.VELOCITY)
    protected velocity: number = 0;

    protected invisible: boolean = false;

    private destroyListeners: Set<Function>;

    private destroyed: boolean = false;

    constructor(transform: Transform) {
        super();
        this.transform = transform;

        this.spriteName = "none";
        this.destroyListeners = new Set<Function>();
    }

    onCollisionEnter(gameObject: GameObject, result: Result) {
        if(CommonConfig.IS_SERVER) {
            this.serverCollision(gameObject, result);
        }
        this.commonCollision(gameObject, result);
    }

    protected serverCollision(gameObject: GameObject, result: Result) {

    }

    protected commonCollision(gameObject: GameObject, result: Result) {

    }

    public forceCompleteUpdate() {
        // this.forceComplete = true;
    }

    public update(delta: number) {
        if(CommonConfig.IS_SERVER) {
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
        if(this.destroyed) {
            return;
        }

        for(let listener of this.destroyListeners) {
            listener(this);
        }
        this.destroyed = true;
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
        // this.addChange(ChangesDict.SPRITE_NAME);
    }

    get Invisible(): boolean {
        return this.invisible;
    }
}