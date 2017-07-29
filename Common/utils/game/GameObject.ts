import {Transform} from "./Transform";
import {ChangesDict} from "./ChangesDict";
import {CommonConfig, Origin} from "../../CommonConfig";
import {Collidable} from "../physics/Collidable";

export abstract class GameObject implements Collidable {
    abstract get Type(): string;

    private static NEXT_ID: number = 0;

    protected id: string = (GameObject.NEXT_ID++).toString();
    protected spriteName: string;
    protected transform: Transform;
    protected velocity: number = 10;

    protected sFunc: Map<string, Function>;
    protected dFunc: Map<string, Function>;
    protected changes: Set<string>;
    private forceComplete: boolean = true;

    private destroyListeners: Set<Function>;

    constructor(transform: Transform) {
        this.transform = transform;
        this.changes = new Set<string>();

        this.sFunc = GameObject.SerializeFunctions;
        this.dFunc = GameObject.DeserializeFunctions;

        this.spriteName = "bunny";
        this.destroyListeners = new Set<Function>();
    }

    abstract onCollisionEnter(gameObject: GameObject);

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

    public serialize(complete: boolean = false): string {
        let update: string = "";

        if(this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        if(complete) {
            this.sFunc.forEach((serializeFunc: Function) => {
                update += serializeFunc(this);
            });
        } else {
            this.changes.forEach((field: string) => {
                if (this.sFunc.has(field)) {
                    update += this.sFunc.get(field)(this);
                    this.changes.delete(field);
                }
            });
        }
        this.changes.clear();

        return update;
    }

    public deserialize(update: string[]) {
        for(let item of update) {
            if(this.dFunc.has(item[0])) {
                this.dFunc.get(item[0])(this, item.split(':')[1]);
            }
        }
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
        this.destroyListeners.clear()
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
        this.changes.add(ChangesDict.SPRITE);
    }

    static serializePosition(gameObject: GameObject): string {
        return ChangesDict.buildTag(ChangesDict.POSITION) + gameObject.Transform.X.toString() + ',' + gameObject.Transform.Y.toString();
    }

    static deserializePosition(gameObject: GameObject, data: string) {
        let x: string = data.split(',')[0];
        let y: string = data.split(',')[1];

        gameObject.transform.X = parseFloat(x);
        gameObject.transform.Y = parseFloat(y);
    }

    static serializeSpriteName(gameObject: GameObject): string {
        return ChangesDict.buildTag(ChangesDict.SPRITE) + gameObject.spriteName;
    }

    static deserializeSpriteName(gameObject: GameObject, data: string) {
        gameObject.spriteName = data;
    }

    static serializeVelocity(bullet: GameObject): string {
        return ChangesDict.buildTag(ChangesDict.VELOCITY) + bullet.velocity;
    }

    static deserializeVelocity(bullet: GameObject, data: string) {
        bullet.velocity = parseFloat(data);
    }

    static serializeRotation(gameObject: GameObject): string {
        return ChangesDict.buildTag(ChangesDict.ROTATION) + gameObject.Transform.Rotation;
    }

    static deserializeRotation(gameObject: GameObject, data: string) {
        gameObject.Transform.Rotation = parseFloat(data);
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.POSITION, GameObject.serializePosition],
        [ChangesDict.SPRITE, GameObject.serializeSpriteName],
        [ChangesDict.VELOCITY, GameObject.serializeVelocity],
        [ChangesDict.ROTATION, GameObject.serializeRotation],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.POSITION, GameObject.deserializePosition],
        [ChangesDict.SPRITE, GameObject.deserializeSpriteName],
        [ChangesDict.VELOCITY, GameObject.deserializeVelocity],
        [ChangesDict.ROTATION, GameObject.deserializeRotation],
    ]);
}