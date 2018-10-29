import {Collisions, Polygon, Circle, Result, Body} from "detect-collisions";
import {GameObject} from "../game/objects/GameObject";
import {SharedConfig} from "../../SharedConfig";

export class CollisionsSystem extends Collisions {
    private bodyToObjectMap: Map<Body, GameObject> = new Map<Body, GameObject>();
    private lastCollisionResult: Result = new Result();

    constructor() {
        super();
    }

    public insertObject(gameObject: GameObject) {
        super.insert(gameObject.Transform.Body);
        this.bodyToObjectMap.set(gameObject.Transform.Body, gameObject);
        this.collidingBodiesMap.set(gameObject.Transform.Body, new Set<Body>());

        if(SharedConfig.IS_SERVER && gameObject.IsSolid && CollisionsSystem.isObjectColliding(gameObject)) {
            gameObject.destroy();
        }
    }

    public removeObject(gameObject: GameObject) {
        if(this.bodyToObjectMap.has(gameObject.Transform.Body)) {
            super.remove(gameObject.Transform.Body);
            this.bodyToObjectMap.delete(gameObject.Transform.Body);
        }

        if(this.collidingBodiesMap.has(gameObject)) {
            this.collidingBodiesMap.delete(gameObject);
        }
    }

    public update() {
        super.update();
    }

    private collidingBodiesMap: Map<Body, Set<Body>> = new Map<Body, Set<Body>>();

    public updateCollisions(gameObjects: Array<GameObject>) {
        gameObjects.forEach((gameObject: GameObject) => {
            this.updateCollisionsForGameObject(gameObject);
        });
    }

    public updateCollisionsForGameObject(gameObject: GameObject) {
        if(gameObject.IsCollisionStatic) {
            //no need to calculate collisions for obstacles since they are not moving
            //that hack gives us huge performance boost when we have thousands of obstacles
            return;
        }
        let objectBody: Body = gameObject.Transform.Body;

        let oldCollidingBodies: Set<Body> = this.collidingBodiesMap.get(objectBody);
        let newCollidingBodies: Set<Body> = new Set<Body>();

        for(let body of this.CollisionBodyIterator(objectBody)) {
            let colidedGameObject: GameObject = this.bodyToObjectMap.get(body);
            if(!colidedGameObject) {
                continue;
            }

            if(!oldCollidingBodies.has(body)) {
                gameObject.onCollisionEnter(colidedGameObject, this.lastCollisionResult)
            }
            newCollidingBodies.add(body);
            gameObject.onCollisionStay(colidedGameObject, this.lastCollisionResult)
        }

        for(let body of oldCollidingBodies) {
            if(!newCollidingBodies.has(body)) {
                let colidedGameObject: GameObject = this.bodyToObjectMap.get(body);
                if(!colidedGameObject) {
                    continue;
                }
                gameObject.onCollisionExit(colidedGameObject);
            }
        }
        this.collidingBodiesMap.set(objectBody, newCollidingBodies);
    }

    static isObjectColliding(object: GameObject): boolean {
        let potentials: Body[] = object.Transform.Body.potentials();

        for(let body of potentials) {
            if(object.Transform.Body.collides(body)) {
                return true;
            }
        }
        return false;
    }

    *CollisionBodyIterator(objectBody: Body) {
        for(let body of objectBody.potentials()) {
            if (objectBody.collides(body, this.lastCollisionResult)) {
                yield body;
            }
        }
    }
}