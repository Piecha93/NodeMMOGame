import { Collisions, Polygon, Circle, Result, Body } from "detect-collisions";
import { GameObject } from "../game/objects/GameObject";

import { Collider } from "../physics/Collider";
import { mayBecomeSolid } from "../game/CollisionPolicy";

const noCollisionBodies: readonly Body[] = [];

export class CollisionsSystem extends Collisions {
    private bodyToColliderMap: Map<Body, Collider> = new Map<Body, Collider>();
    private collidingBodiesMap: Map<Body, Set<Body>> = new Map<Body, Set<Body>>();
    private readonly incomingCollidingBodiesMap = new Map<Body, Set<Body>>();
    private lastCollisionResult: Result = new Result();
    private readonly solidCandidates = new Set<GameObject>();
    private solidCandidatesDirty = false;

    constructor() {
        super();
    }

    public insertObject(gameObject: GameObject) {
        if (mayBecomeSolid(gameObject)) this.solidCandidates.add(gameObject);
        for (let collider of gameObject.Colliders) {
            super.insert(collider.Body);

            this.bodyToColliderMap.set(collider.Body, collider);
            this.collidingBodiesMap.set(collider.Body, new Set<Body>());
        }

        if (gameObject.Runtime.isServer && gameObject.IsSolid && this.isObjectColliding(gameObject)) {
            gameObject.destroy();
        }
    }

    public removeObject(gameObject: GameObject) {
        this.solidCandidates.delete(gameObject);
        for (let collider of gameObject.Colliders) {
            const body = collider.Body;
            this.unlinkOutgoingContacts(body);
            this.collidingBodiesMap.delete(body);

            // Contact histories are directional. Only sources which currently
            // retain this target need cleanup when a projectile disappears.
            const incoming = this.incomingCollidingBodiesMap.get(body);
            if (incoming) {
                for (const source of incoming) this.collidingBodiesMap.get(source)?.delete(body);
                this.incomingCollidingBodiesMap.delete(body);
            }

            if (this.bodyToColliderMap.has(body)) {
                super.remove(body);
                this.bodyToColliderMap.delete(body);
            }
        }
    }

    public update(): CollisionsSystem {
        this.refreshSolidCandidates();
        super.update();
        return this;
    }

    /** Publish final geometry; refresh contact capabilities when next needed. */
    public updateGeometry(): CollisionsSystem {
        this.solidCandidatesDirty = true;
        super.update();
        return this;
    }

    public updateCollisions(gameObjects: Array<GameObject>) {
        for (const gameObject of Array.from(gameObjects)) {
            this.updateCollisionsForGameObject(gameObject);
        }
    }

    public updateCollisionsForGameObject(gameObject: GameObject) {
        if (
            gameObject.IsDestroyed ||
            gameObject.IsCollisionStatic ||
            (gameObject.Runtime.isClient && !gameObject.predictionEnabled)
        ) {
            return;
        }

        if (this.solidCandidatesDirty) this.update();

        for (let collider of gameObject.Colliders) {
            if (!this.isRegisteredCollider(collider)) {
                continue;
            }
            let colliderBody: Body = collider.Body;
            const onlySolidTargets = gameObject.canSkipNonSolidContacts(collider);
            const contactFilter = gameObject.contactFilter(collider);

            let oldCollidingBodies: Set<Body> = this.collidingBodiesMap.get(colliderBody) || new Set<Body>();
            // An empty history already represents the complete result when no
            // solid target can exist. Keep it instead of allocating another
            // empty set for every stock actor on every tick. Retained contacts
            // still use the normal path so their exit callbacks are delivered.
            if (onlySolidTargets && this.solidCandidates.size === 0 && oldCollidingBodies.size === 0) continue;
            let newCollidingBodies: Set<Body> = new Set<Body>();
            // Publish the current contacts before callbacks, so removeObject can
            // clean them even when a callback destroys an earlier contact.
            this.unlinkOutgoingContacts(colliderBody);
            this.collidingBodiesMap.set(colliderBody, newCollidingBodies);

            const potentials =
                this.solidCandidates.size === 0 &&
                (onlySolidTargets || gameObject.canSkipContactsWithoutSolidCandidates(collider))
                    ? noCollisionBodies
                    : colliderBody.potentials();
            for (const body of potentials) {
                const colidedCollider = this.bodyToColliderMap.get(body);
                if (
                    !colidedCollider ||
                    colidedCollider.Parent === gameObject ||
                    (onlySolidTargets && !colidedCollider.Parent.IsSolid) ||
                    (contactFilter !== null && !contactFilter(colidedCollider)) ||
                    !this.isRegisteredCollider(colidedCollider) ||
                    !collider.collides(colidedCollider, this.lastCollisionResult)
                ) {
                    continue;
                }

                if (!oldCollidingBodies.has(body)) {
                    collider.onCollisionEnter(colidedCollider, this.lastCollisionResult);
                    if (!this.isRegisteredCollider(collider)) {
                        return;
                    }
                    if (!this.isRegisteredCollider(colidedCollider)) {
                        continue;
                    }
                }
                newCollidingBodies.add(body);
                // A custom callback may recursively process this source. Only
                // the set still published in the map belongs in the index.
                if (this.collidingBodiesMap.get(colliderBody) === newCollidingBodies) {
                    let incoming = this.incomingCollidingBodiesMap.get(body);
                    if (!incoming) {
                        incoming = new Set<Body>();
                        this.incomingCollidingBodiesMap.set(body, incoming);
                    }
                    incoming.add(colliderBody);
                }
                collider.onCollisionStay(colidedCollider, this.lastCollisionResult);
                if (!this.isRegisteredCollider(collider)) {
                    return;
                }
                if (!this.isRegisteredCollider(colidedCollider)) {
                    newCollidingBodies.delete(body);
                    if (this.collidingBodiesMap.get(colliderBody) === newCollidingBodies)
                        this.unlinkContact(colliderBody, body);
                }
            }

            for (let body of oldCollidingBodies) {
                if (!newCollidingBodies.has(body)) {
                    const colidedCollider = this.bodyToColliderMap.get(body);
                    if (
                        !colidedCollider ||
                        colidedCollider.Parent === gameObject ||
                        !this.isRegisteredCollider(colidedCollider)
                    ) {
                        continue;
                    }
                    collider.onCollisionExit(colidedCollider, this.createExitResult(colliderBody, body));
                    if (!this.isRegisteredCollider(collider)) {
                        return;
                    }
                }
            }
        }
    }

    private unlinkOutgoingContacts(source: Body): void {
        for (const target of this.collidingBodiesMap.get(source) ?? noCollisionBodies) {
            this.unlinkContact(source, target);
        }
    }

    private refreshSolidCandidates(): void {
        // Clear before invoking custom getters, matching the partial index a
        // reentrant collision query can observe during a normal full update.
        this.solidCandidatesDirty = false;
        this.solidCandidates.clear();
        for (const collider of this.bodyToColliderMap.values())
            if (mayBecomeSolid(collider.Parent)) this.solidCandidates.add(collider.Parent);
    }

    private unlinkContact(source: Body, target: Body): void {
        const incoming = this.incomingCollidingBodiesMap.get(target);
        if (!incoming) return;
        incoming.delete(source);
        if (incoming.size === 0) this.incomingCollidingBodiesMap.delete(target);
    }

    private isRegisteredCollider(collider: Collider): boolean {
        return !collider.Parent.IsDestroyed && this.bodyToColliderMap.get(collider.Body) === collider;
    }

    isObjectColliding(object: GameObject): boolean {
        for (let collider of object.Colliders) {
            let potentials: Body[] = collider.Body.potentials();
            for (let body of potentials) {
                const otherCollider = this.bodyToColliderMap.get(body);
                if (!otherCollider || collider.Parent === otherCollider.Parent) {
                    //skip check colliders with same parent
                    continue;
                }
                if (collider.collides(otherCollider)) {
                    return true;
                }
            }
        }
        return false;
    }

    private createExitResult(source: Body, target: Body): Result {
        let result: Result = new Result();
        result.collision = false;
        result.a = source;
        result.b = target;
        result.a_in_b = false;
        result.b_in_a = false;
        result.overlap = 0;
        result.overlap_x = 0;
        result.overlap_y = 0;
        return result;
    }

    *CollisionBodyIterator(objectBody: Body): Generator<Body, void, undefined> {
        for (let body of objectBody.potentials()) {
            if (objectBody.collides(body, this.lastCollisionResult)) {
                yield body;
            }
        }
    }
}
