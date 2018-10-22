import {Collisions, Polygon, Circle, Result, Body} from "detect-collisions";
import {GameObject} from "../game/objects/GameObject";
import {SharedConfig} from "../../SharedConfig";

export class CollisionsSystem extends Collisions {
    private bodyToObjectMap: Map<Body, GameObject> = new Map<Body, GameObject>();
    private result: Result = new Result();

    constructor() {
        super();
    }

    public insertObject(gameObject: GameObject) {
        super.insert(gameObject.Transform.Body);
        this.bodyToObjectMap.set(gameObject.Transform.Body, gameObject);
        this.collidingObjectsMap.set(gameObject, new Set<GameObject>());

        if(SharedConfig.IS_SERVER && gameObject.IsSolid && this.checkObjectCollision(gameObject)) {
            gameObject.destroy();
        }
    }

    public removeObject(gameObject: GameObject) {
        if(this.bodyToObjectMap.has(gameObject.Transform.Body)) {
            super.remove(gameObject.Transform.Body);
            this.bodyToObjectMap.delete(gameObject.Transform.Body);
        }

        if(this.collidingObjectsMap.has(gameObject)) {
            this.collidingObjectsMap.delete(gameObject);
        }
    }

    public update() {
        super.update();
    }

    private collidingObjectsMap: Map<GameObject, Set<GameObject>> = new Map<GameObject, Set<GameObject>>();

    public updateCollisions(gameObjects: Array<GameObject>) {
        gameObjects.forEach((gameObject: GameObject) => {
            if(gameObject.IsCollisionStatic) {
                //no need to calculate collisions for obstacles since they are not moving
                //that hack gives us huge performance boost when we have thousands of obstacles
                return;
            }
            let potentials: Body[] = gameObject.Transform.Body.potentials();

            let oldCollidingObjects: Set<GameObject> = this.collidingObjectsMap.get(gameObject);
            let newCollidingObjects: Set<GameObject> = new Set<GameObject>();

            for(let body of potentials) {
                let colidedGameObject: GameObject = this.bodyToObjectMap.get(body);
                if(!colidedGameObject) {
                    continue;
                }

                if(gameObject.Transform.Body.collides(body, this.result)) {
                    if(!oldCollidingObjects.has(colidedGameObject)) {
                        gameObject.onCollisionEnter(colidedGameObject, this.result)
                    }
                    newCollidingObjects.add(colidedGameObject);
                    gameObject.onCollisionStay(colidedGameObject, this.result)
                }
            }

            for(let object of oldCollidingObjects) {
                if(!newCollidingObjects.has(object)) {
                    gameObject.onCollisionExit(object);
                }
            }

            this.collidingObjectsMap.set(gameObject, newCollidingObjects);
        });
    }

    public checkObjectCollision(object: GameObject): boolean {
        let potentials: Body[] = object.Transform.Body.potentials();

        for(let body of potentials) {
            if(object.Transform.Body.collides(body)) {
                return true;
            }
        }
        return false;
    }

    public updateCollisionsForObject(gameObject: GameObject) {
        super.update();

        let potentials: Body[] = gameObject.Transform.Body.potentials();

        for(let body of potentials) {
            if(gameObject.Transform.Body.collides(body, this.result)) {
                gameObject.onCollisionEnter(this.bodyToObjectMap.get(body), this.result)
            }
        }
    }
}