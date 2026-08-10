import {Collisions, Polygon, Circle, Result, Body} from "detect-collisions";
import {GameObject} from "../game/objects/GameObject";
import {SharedConfig} from "../../SharedConfig";
import {Collider} from "../physics/Collider";

export class CollisionsSystem extends Collisions {
    private bodyToColliderMap: Map<Body, Collider> = new Map<Body, Collider>();
    private collidingBodiesMap: Map<Body, Set<Body>> = new Map<Body, Set<Body>>();
    private lastCollisionResult: Result = new Result();

    constructor() {
        super();
    }

    public insertObject(gameObject: GameObject) {
        for(let collider of gameObject.Colliders) {
            super.insert(collider.Body);

            this.bodyToColliderMap.set(collider.Body, collider);
            this.collidingBodiesMap.set(collider.Body, new Set<Body>());
        }

        if(SharedConfig.IS_SERVER && gameObject.IsSolid && this.isObjectColliding(gameObject)) {
            gameObject.destroy();
        }
    }

    public removeObject(gameObject: GameObject) {
        for(let collider of gameObject.Colliders) {
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
        super.update();
        return this;
    }

    public updateCollisions(gameObjects: Array<GameObject>) {
        gameObjects.forEach((gameObject: GameObject) => {
            this.updateCollisionsForGameObject(gameObject);
        });
    }

    public updateCollisionsForGameObject(gameObject: GameObject) {
        for(let collider of gameObject.Colliders) {
            if (gameObject.IsCollisionStatic) {
                //no need to calculate collisions for obstacles since they are not moving
                //that hack gives us huge performance boost when we have thousands of obstacles
                return;
            }
            let colliderBody: Body = collider.Body;

            let oldCollidingBodies: Set<Body> = this.collidingBodiesMap.get(colliderBody) || new Set<Body>();
            let newCollidingBodies: Set<Body> = new Set<Body>();

            for (let body of this.CollisionBodyIterator(colliderBody)) {
                let colidedCollider: Collider = this.bodyToColliderMap.get(body);
                if (!colidedCollider || colidedCollider == collider) {
                    continue;
                }

                if (!oldCollidingBodies.has(body)) {
                    collider.onCollisionEnter(colidedCollider, this.lastCollisionResult)
                }
                newCollidingBodies.add(body);
                collider.onCollisionStay(colidedCollider, this.lastCollisionResult)
            }

            for (let body of oldCollidingBodies) {
                if (!newCollidingBodies.has(body)) {
                    let colidedCollider: Collider = this.bodyToColliderMap.get(body);
                    if (!colidedCollider || colidedCollider == collider) {
                        continue;
                    }
                    collider.onCollisionExit(colidedCollider, this.createExitResult(colliderBody, body));
                }
            }
            this.collidingBodiesMap.set(colliderBody, newCollidingBodies);
        }
    }

    isObjectColliding(object: GameObject): boolean {
        for(let collider of object.Colliders) {
            let potentials: Body[] = collider.Body.potentials();
            for (let body of potentials) {
                let otherCollider: Collider = this.bodyToColliderMap.get(body);
                if(!otherCollider || collider.Parent.ID == otherCollider.Parent.ID) {
                    //skip check colliders with same parent
                    continue;
                }
                if(collider.Body.collides(body)) {
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
        for(let body of objectBody.potentials()) {
            if (objectBody.collides(body, this.lastCollisionResult)) {
                yield body;
            }
        }
    }
}
