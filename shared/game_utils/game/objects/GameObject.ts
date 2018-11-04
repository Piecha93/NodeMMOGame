import {Size, Transform} from "../../physics/Transform";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {SharedConfig} from "../../../SharedConfig";
import {Serializable, SerializableTypes} from "../../../serialize/Serializable";
import {SerializableObject, SerializableProperty} from "../../../serialize/SerializeDecorators";
import {Result} from "detect-collisions";
import {ResourcesMap} from "../../ResourcesMap";
import {Collider} from "../../physics/Collider";
import {Collision} from "../../physics/Collision";


export class GameObject extends Serializable {// implements Collidable {
    protected id: string = "";
    protected spriteName: string;

    @SerializableObject("pos")
    protected transform: Transform;
    @SerializableProperty(ChangesDict.VELOCITY, SerializableTypes.Float32)
    protected velocity: number = 0;
    @SerializableProperty("INV", SerializableTypes.Uint8)
    protected invisible: boolean = false;

    private colliders: Array<Collider> = [];

    private destroyListeners: Set<Function>;

    private isDestroyed: boolean = false;

    protected isChunkActivateTriger: boolean = false;
    protected isChunkFullUpdateTriger: boolean = false;
    protected isChunkDeactivationPersistent: boolean = false;

    //if true object will not recive onCollisionEnter event
    protected isCollisionStatic: boolean = false;
    //if true objects cannot go through it
    protected isSolid: boolean = false;

    constructor(transform: Transform) {
        super();
        this.transform = transform;

        this.addCollider([transform.ScaleX, transform.ScaleY]);

        this.SpriteName = "none";
        this.destroyListeners = new Set<Function>();
    }

    public addCollider(size: Size): Collider {
        let collider: Collider = new Collider(this, size);
        this.colliders.push(collider);

        return collider;
    }

    public onCollisionEnter(collision: Collision) {
        if(this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.serverOnCollisionEnter(collision);
        }
        this.sharedOnCollisionEnter(collision);
    }

    public onCollisionStay(collision: Collision) {
        if(this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.serverOnCollisionStay(collision);
        }
        this.sharedOnCollisionStay(collision);
    }

    public onCollisionExit(collision: Collision) {
        if(this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.serverOnCollisionExit(collision);
        }
        this.sharedOnCollisionExit(collision);
    }

    protected serverOnCollisionEnter(collision: Collision) {
    }

    protected sharedOnCollisionEnter(collision: Collision) {
    }

    protected serverOnCollisionStay(collision: Collision) {
    }

    protected sharedOnCollisionStay(collision: Collision) {
    }

    protected serverOnCollisionExit(collision: Collision) {
    }

    protected sharedOnCollisionExit(collision: Collision) {
    }

    public onTriggerEnter(collision: Collision) {
        if(this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.serverOnTriggerEnter(collision);
        }
        this.sharedOnTriggerEnter(collision);
    }

    public onTriggerStay(collision: Collision) {
        if(this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.serverOnTriggerStay(collision);
        }
        this.sharedOnTriggerStay(collision);
    }

    public onTriggerExit(collision: Collision) {
        if(this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.serverOnTriggerExit(collision);
        }
        this.sharedOnTriggerExit(collision);
    }

    protected serverOnTriggerEnter(collision: Collision) {
    }

    protected sharedOnTriggerEnter(collision: Collision) {
    }

    protected serverOnTriggerStay(collision: Collision) {
    }

    protected sharedOnTriggerStay(collision: Collision) {
    }

    protected serverOnTriggerExit(collision: Collision) {
    }

    protected sharedOnTriggerExit(collision: Collision) {
    }

    public forceCompleteUpdate() {
        this.forceComplete = true;
    }

    public update(delta: number) {
        if(SharedConfig.IS_SERVER) {
            this.serverUpdate(delta);
        }
        this.commonUpdate(delta);

        this.updateColliders();
    }

    public updateColliders() {
        for(let collider of this.colliders) {
            collider.update();
        }
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

    get IsChunkDeactivationPersistent(): boolean {
        return this.isChunkDeactivationPersistent;
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

    get Colliders(): Array<Collider> {
        return this.colliders;
    }
}