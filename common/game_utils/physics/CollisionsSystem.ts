import {Collisions, Polygon, Circle, Result, Body} from "detect-collisions";
import {GameObject} from "../game/objects/GameObject";
import {Obstacle} from "../game/objects/Obstacle";

export class CollisionsSystem extends Collisions {
    private bodyToObjectMap: Map<Body, GameObject> = new Map<Body, GameObject>();

    constructor() {
        super();
    }

    public insertObject(gameObject: GameObject) {
        super.insert(gameObject.Transform.Body);
        this.bodyToObjectMap.set(gameObject.Transform.Body, gameObject);
    }

    public removeObject(gameObject: GameObject) {
        super.remove(gameObject.Transform.Body);
        this.bodyToObjectMap.delete(gameObject.Transform.Body);
    }

    public updateCollisions(gameObjectsMapById: Map<string, GameObject>) {
        super.update();

        let result = new Result();

        gameObjectsMapById.forEach((object: GameObject) => {
            if(object instanceof Obstacle) {
                //no need to calculate collisions for obstacles since they are not moving
                //that hack gives us huge performance boost when we have thousands of obstacles
                return;
            }
            let potentials: Body[] = object.Transform.Body.potentials();

            for(let body of potentials) {
                if(object.Transform.Body.collides(body, result)) {
                    object.onCollisionEnter(this.bodyToObjectMap.get(body), result)
                }
            }
        });
    }

    public updateCollisionsForObject(gameObject: GameObject) {
        super.update();
        let result = new Result();

        let potentials: Body[] = gameObject.Transform.Body.potentials();

        for(let body of potentials) {
            if(gameObject.Transform.Body.collides(body, result)) {
                gameObject.onCollisionEnter(this.bodyToObjectMap.get(body), result)
            }
        }
    }
}