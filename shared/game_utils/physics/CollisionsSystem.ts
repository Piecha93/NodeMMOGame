import { Collisions, Polygon, Circle, Result, Body } from "detect-collisions";
import { GameObject } from "../game/objects/GameObject";

import { Collider } from "../physics/Collider";
import { mayBecomeSolid } from "../game/CollisionPolicy";

const noCollisionBodies: readonly Body[] = [];

export class CollisionsSystem extends Collisions {
    private bodyToColliderMap: Map<Body, Collider> = new Map<Body, Collider>();
    private collidingBodiesMap: Map<Body, Set<Body>> = new Map<Body, Set<Body>>();
    private lastCollisionResult: Result = new Result();
    private readonly solidCandidates = new Set<GameObject>();

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
            for (let collidingBodies of this.collidingBodiesMap.values()) {
                collidingBodies.delete(collider.Body);
            }

            if (this.bodyToColliderMap.has(collider.Body)) {
                super.remove(collider.Body);
                this.bodyToColliderMap.delete(collider.Body);
            }

            if (this.collidingBodiesMap.has(collider.Body)) {
                this.collidingBodiesMap.delete(collider.Body);
            }
        }
    }

    public update(): CollisionsSystem {
        this.solidCandidates.clear();
        for (const collider of this.bodyToColliderMap.values())
            if (mayBecomeSolid(collider.Parent)) this.solidCandidates.add(collider.Parent);
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

        for (let collider of gameObject.Colliders) {
            if (!this.isRegisteredCollider(collider)) {
                continue;
            }
            let colliderBody: Body = collider.Body;
            const onlySolidTargets = gameObject.canSkipNonSolidContacts(collider);
            const contactFilter = gameObject.contactFilter(collider);

            let oldCollidingBodies: Set<Body> = this.collidingBodiesMap.get(colliderBody) || new Set<Body>();
            let newCollidingBodies: Set<Body> = new Set<Body>();
            // Publish the current contacts before callbacks, so removeObject can
            // clean them even when a callback destroys an earlier contact.
            this.collidingBodiesMap.set(colliderBody, newCollidingBodies);

            const potentials =
                onlySolidTargets && this.solidCandidates.size === 0 ? noCollisionBodies : colliderBody.potentials();
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
                collider.onCollisionStay(colidedCollider, this.lastCollisionResult);
                if (!this.isRegisteredCollider(collider)) {
                    return;
                }
                if (!this.isRegisteredCollider(colidedCollider)) {
                    newCollidingBodies.delete(body);
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
