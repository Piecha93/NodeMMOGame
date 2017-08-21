import {Transform} from "../physics/Transform";
import {CommonConfig, Origin} from "../../CommonConfig";
import {Collidable} from "../physics/Collidable";
import {NetworkProperty} from "./NetworkPropertyDecorator";

export abstract class GameObject implements Collidable {
    protected id: string = "";
    @NetworkProperty
    protected spriteName: string = "";
    protected transform: Transform;

    @NetworkProperty
    protected velocity: number = 10;
    protected changes: Set<string>;

    private forceComplete: boolean = true;

    private destroyListeners: Set<Function>;

    constructor(transform: Transform) {
        this.transform = transform;
        this.changes = new Set<string>();

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

    public serialize(complete: boolean = false): string {
        let update: string = "";

        if(this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        if(complete) {
            this['networkProperties'].forEach((prop: string) => {
                update += "#" + prop + ":" + this[prop];
            });
            this.Transform['networkProperties'].forEach((prop: string) => {
                // prop = prop.charAt(0).toUpperCase() + prop.slice(1);
                update += "#" + prop + ":" + this.Transform[prop];
            });
        } else {
            this["serializedProperties"].forEach((val: string, key: any) => {
                update += "#" + key + ":" + val;
            });
            this.Transform["serializedProperties"].forEach((val: string, key: any) => {
                update += "#" + key + ":" + val;
            });
        }

        // if(this["serializedProperties"].size > 0) {
        //     console.log(this["serializedProperties"]);
        // }
        // if(this.Transform["serializedProperties"].size > 0) {
        //     console.log(this.Transform["serializedProperties"]);
        // }
        this["serializedProperties"].clear();
        this.Transform["serializedProperties"].clear();

        return update;
    }

    public deserialize(update: string[]) {
        console.log(update);

        update.forEach((item: string) => {
            let splited = item.split(':');
            if(this['networkProperties'].indexOf(splited[0]) != -1) {
                this[splited[0]] = splited[1];
            }
            if(this.Transform['networkProperties'].indexOf(splited[0]) != -1) {
                let prop: string = splited[0].charAt(0).toUpperCase() + splited[0].slice(1);
                this.Transform[prop] = Number(splited[1]);
            }
        });
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
    }

    // static serializePosition(gameObject: GameObject): string {
    //     return ChangesDict.buildTag(ChangesDict.POSITION)
    //         + gameObject.Transform.X.toPrecision(10)
    //         + ',' + gameObject.Transform.Y.toPrecision(10);
    // }
    //
    // static deserializePosition(gameObject: GameObject, data: string) {
    //     let x: string = data.split(',')[0];
    //     let y: string = data.split(',')[1];
    //
    //     gameObject.transform.X = parseFloat(x);
    //     gameObject.transform.Y = parseFloat(y);
    // }
    //
    // static serializeSize(gameObject: GameObject): string {
    //     return ChangesDict.buildTag(ChangesDict.SIZE)
    //         + gameObject.Transform.Width + ',' + gameObject.Transform.Height;
    // }
    //
    // static deserializeSize(gameObject: GameObject, data: string) {
    //     let w: string = data.split(',')[0];
    //     let h: string = data.split(',')[1];
    //
    //     gameObject.transform.Width = parseFloat(w);
    //     gameObject.transform.Height = parseFloat(h);
    // }
    //
    // static serializeSpriteName(gameObject: GameObject): string {
    //     return ChangesDict.buildTag(ChangesDict.SPRITE) + gameObject.spriteName;
    // }
    //
    // static deserializeSpriteName(gameObject: GameObject, data: string) {
    //     gameObject.spriteName = data;
    // }
    //
    // static serializeVelocity(bullet: GameObject): string {
    //     return ChangesDict.buildTag(ChangesDict.VELOCITY) + bullet.velocity;
    // }
    //
    // static deserializeVelocity(bullet: GameObject, data: string) {
    //     bullet.velocity = parseFloat(data);
    // }
    //
    // static serializeRotation(gameObject: GameObject): string {
    //     return ChangesDict.buildTag(ChangesDict.ROTATION) + gameObject.Transform.Rotation.toPrecision(4);
    // }
    //
    // static deserializeRotation(gameObject: GameObject, data: string) {
    //     gameObject.Transform.Rotation = parseFloat(data);
    // }
    //
    // static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
    //     [ChangesDict.POSITION, GameObject.serializePosition],
    //     [ChangesDict.SIZE, GameObject.serializeSize],
    //     [ChangesDict.SPRITE, GameObject.serializeSpriteName],
    //     [ChangesDict.VELOCITY, GameObject.serializeVelocity],
    //     [ChangesDict.ROTATION, GameObject.serializeRotation],
    // ]);
    // static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
    //     [ChangesDict.POSITION, GameObject.deserializePosition],
    //     [ChangesDict.SIZE, GameObject.deserializeSize],
    //     [ChangesDict.SPRITE, GameObject.deserializeSpriteName],
    //     [ChangesDict.VELOCITY, GameObject.deserializeVelocity],
    //     [ChangesDict.ROTATION, GameObject.deserializeRotation],
    // ]);
}