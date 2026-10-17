import { ReplicatedState } from "../../../core/ReplicatedState";
import { Size, Transform } from "../../physics/Transform";
import { ChangesDict } from "../../../core/ChangeKeys";

import { Result } from "detect-collisions";
import { Collider } from "../../physics/Collider";
import { Collision } from "../../physics/Collision";
import type { GameObjectsFactory } from "../../factory/ObjectsFactory";

export class GameObject extends ReplicatedState {
    // implements Collidable {
    protected id: string = "";
    protected spriteName: string = "none";
    protected transform: Transform;
    protected velocity: number = 0;
    protected invisible: boolean = false;

    private colliders: Array<Collider> = [];

    private destroyListeners: Set<Function>;

    private objectsFactory: GameObjectsFactory | null = null;

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

    protected override replicatedChildren(): readonly ReplicatedState[] {
        return [this.transform];
    }

    public addCollider(size: Size): Collider {
        let collider: Collider = new Collider(this, size);
        this.colliders.push(collider);

        return collider;
    }

    public onCollisionEnter(collision: Collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if (this.Runtime.isServer) {
            this.serverOnCollisionEnter(collision);
        }
        this.sharedOnCollisionEnter(collision);
    }

    public onCollisionStay(collision: Collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if (this.Runtime.isServer) {
            this.serverOnCollisionStay(collision);
        }
        this.sharedOnCollisionStay(collision);
    }

    public onCollisionExit(collision: Collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if (this.Runtime.isServer) {
            this.serverOnCollisionExit(collision);
        }
        this.sharedOnCollisionExit(collision);
    }

    protected serverOnCollisionEnter(collision: Collision) {}

    protected sharedOnCollisionEnter(collision: Collision) {}

    protected serverOnCollisionStay(collision: Collision) {}

    protected sharedOnCollisionStay(collision: Collision) {}

    protected serverOnCollisionExit(collision: Collision) {}

    protected sharedOnCollisionExit(collision: Collision) {}

    public onTriggerEnter(collision: Collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if (this.Runtime.isServer) {
            this.serverOnTriggerEnter(collision);
        }
        this.sharedOnTriggerEnter(collision);
    }

    public onTriggerStay(collision: Collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if (this.Runtime.isServer) {
            this.serverOnTriggerStay(collision);
        }
        this.sharedOnTriggerStay(collision);
    }

    public onTriggerExit(collision: Collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }

        if (this.Runtime.isServer) {
            this.serverOnTriggerExit(collision);
        }
        this.sharedOnTriggerExit(collision);
    }

    protected serverOnTriggerEnter(collision: Collision) {}

    protected sharedOnTriggerEnter(collision: Collision) {}

    protected serverOnTriggerStay(collision: Collision) {}

    protected sharedOnTriggerStay(collision: Collision) {}

    protected serverOnTriggerExit(collision: Collision) {}

    protected sharedOnTriggerExit(collision: Collision) {}

    public forceCompleteUpdate() {
        this.forceComplete = true;
    }

    public predictionEnabled = true;

    public update(delta: number) {
        if (this.Runtime.isClient && !this.predictionEnabled) return;
        if (this.Runtime.isServer) {
            this.serverUpdate(delta);
        }
        if (this.IsDestroyed) return;
        this.commonUpdate(delta);

        this.updateColliders();
    }

    public updateColliders() {
        for (let collider of this.colliders) {
            collider.update();
        }
    }

    /** Custom objects observe all contacts unless their domain behaviour opts out. */
    public canSkipNonSolidContacts(collider: Collider): boolean {
        return false;
    }

    public canSkipContactsWithoutSolidCandidates(collider: Collider): boolean {
        return false;
    }

    public contactFilter(collider: Collider): ((other: Collider) => boolean) | null {
        return null;
    }

    protected commonUpdate(delta: number) {}

    protected serverUpdate(delta: number) {}

    addDestroyListener(listener: Function) {
        this.destroyListeners.add(listener);
    }

    removeDestroyListener(listener: Function) {
        this.destroyListeners.delete(listener);
    }

    public attachObjectsFactory(objectsFactory: GameObjectsFactory): void {
        if (!objectsFactory) {
            throw new Error("Cannot attach a game object without a factory");
        }
        if (this.objectsFactory && this.objectsFactory !== objectsFactory) {
            throw new Error(`Game object '${this.ID}' already belongs to another factory`);
        }

        this.setRuntime(objectsFactory.Runtime);
        this.objectsFactory = objectsFactory;
    }

    public detachObjectsFactory(objectsFactory: GameObjectsFactory): void {
        if (this.objectsFactory === objectsFactory) {
            this.objectsFactory = null;
        }
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        const errors: unknown[] = [];
        for (const listener of Array.from(this.destroyListeners)) {
            try {
                listener(this);
            } catch (error) {
                errors.push(error);
            }
        }
        this.destroyListeners.clear();

        if (errors.length > 0) {
            throw new AggregateError(errors, `Destroy listeners failed for '${this.ID}'`);
        }
    }

    interact() {}

    get Transform(): Transform {
        return this.transform;
    }

    get ObjectsFactory(): GameObjectsFactory {
        if (!this.objectsFactory) {
            throw new Error(`Game object '${this.ID}' is not attached to a factory`);
        }
        return this.objectsFactory;
    }

    get ID(): string {
        return this.id;
    }

    get Velocity(): number {
        return this.velocity;
    }

    set Velocity(val: number) {
        if (this.velocity !== val) {
            this.velocity = val;
            this.addChange(ChangesDict.VELOCITY);
        }
    }

    set ID(id: string) {
        if (this.id && this.id !== id) {
            throw new Error(`Game object id cannot change from '${this.id}' to '${id}'`);
        }
        this.id = id;
    }

    get SpriteName(): string {
        return this.spriteName;
    }

    set SpriteName(spriteName: string) {
        if (this.spriteName != spriteName) {
            this.spriteName = spriteName;
            this.addChange(ChangesDict.SPRITE_ID);
        }
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

    get InteractPopUpMessage(): string | null {
        return null;
    }

    get Colliders(): Array<Collider> {
        return this.colliders;
    }
}
