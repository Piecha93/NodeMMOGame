import {Transform} from "../../physics/Transform";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {SharedConfig} from "../../../SharedConfig";
import {Serializable, SerializableTypes} from "../../../serialize/Serializable";
import {SerializableObject, SerializableProperty} from "../../../serialize/SerializeDecorators";
import {Result} from "detect-collisions";
import {ResourcesMap} from "../../ResourcesMap";
import {Actor} from "./Actor";

export class GameObject extends Serializable {
    protected id: string = "";
    protected spriteName: string;

    @SerializableObject("pos")
    protected transform: Transform;
    @SerializableProperty(ChangesDict.VELOCITY, SerializableTypes.Float32)
    protected velocity: number = 0;
    @SerializableProperty("INV", SerializableTypes.Uint8)
    protected invisible: boolean = false;

    private destroyListeners: Set<Function>;

    private isDestroyed: boolean = false;

    protected isChunkActivateTriger: boolean = false;
    protected isChunkFullUpdateTriger: boolean = false;

    //if true object will not recive onCollisionEnter event
    protected isCollisionStatic: boolean = false;
    //if true objects cannot go through it
    protected isSolid: boolean = false;

    constructor(transform: Transform) {
        super();
        this.transform = transform;

        this.SpriteName = "none";
        this.destroyListeners = new Set<Function>();
    }

    onCollisionEnter(gameObject: GameObject, result: Result) {
        if(this.IsDestroyed || gameObject.IsDestroyed) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.serverCollision(gameObject, result);
        }
        this.commonCollision(gameObject, result);
    }

    protected serverCollision(gameObject: GameObject, result: Result) {

    }

    protected commonCollision(gameObject: GameObject, result: Result) {

    }

    public forceCompleteUpdate() {
        this.forceComplete = true;
    }

    public update(delta: number) {
        if(SharedConfig.IS_SERVER) {
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
        if(this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        for(let listener of this.destroyListeners) {
            listener(this);
        }
    }

    interact() {

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
        if(this.spriteName != spriteName) {
            this.spriteName = spriteName;
            this.addChange(ChangesDict.SPRITE_ID);
        }
    }

    @SerializableProperty(ChangesDict.SPRITE_ID, SerializableTypes.Uint16)
    set SpriteId(id: number) {
        this.spriteName = ResourcesMap.IdToName.get(id);
    }

    get SpriteId(): number {
        return ResourcesMap.NameToId.get(this.spriteName);
    }

    get Invisible(): boolean {
        return this.invisible;
    }

    get IsDestroyed(): boolean {
        return this.isDestroyed;
    }

    get IsChunkActivateTriger(): boolean {
        return this.isChunkActivateTriger;
    }

    get IsChunkFullUpdateTriger(): boolean {
        return this.isChunkFullUpdateTriger;
    }

    get IsCollisionStatic(): boolean {
        return this.isCollisionStatic;
    }

    get IsSolid(): boolean {
        return this.isSolid;
    }

    get InteractPopUpMessage(): string {
        return null;
    }
}