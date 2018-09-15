import {Collisions, Polygon, Circle, Result, Body} from "detect-collisions";
import {GameObject} from "../game/objects/GameObject";
import {Obstacle} from "../game/objects/Obstacle";
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

        if(SharedConfig.IS_SERVER && gameObject instanceof Obstacle && this.checkObjectCollision(gameObject)) {
            gameObject.destroy();
        }
    }

    public removeObject(gameObject: GameObject) {
        if(this.bodyToObjectMap.has(gameObject.Transform.Body)) {
            super.remove(gameObject.Transform.Body);
            this.bodyToObjectMap.delete(gameObject.Transform.Body);
        }
    }

    public update() {
        super.update();
    }

    public updateCollisions(gameObjects: Array<GameObject>) {
        gameObjects.forEach((object: GameObject) => {
            if(object instanceof Obstacle) {
                //no need to calculate collisions for obstacles since they are not moving
                //that hack gives us huge performance boost when we have thousands of obstacles
                return;
            }
            let potentials: Body[] = object.Transform.Body.potentials();

            for(let body of potentials) {
                if(this.bodyToObjectMap.has(body) && object.Transform.Body.collides(body, this.result)) {
                    object.onCollisionEnter(this.bodyToObjectMap.get(body), this.result)
                }
            }
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