import {GameObject} from "./utils/game/GameObject";
import {GameObjectsSubscriber} from "./utils/game/GameObjectsSubscriber";
import {Collisions, Polygon, Circle, Result, Body} from "detect-collisions";

export class GameWorld extends GameObjectsSubscriber {
    private collistionsSystem: Collisions = new Collisions();

    private height: number;
    private width: number;

    constructor(width: number, height: number) {
        super();
        this.width = width;
        this.height = height;
        console.log("create game instance");
    }

    public update(delta: number) {
        this.GameObjectsMapById.forEach((object: GameObject) => {
            object.update(delta);
        });

        this.collistionsSystem.update();

        let result = new Result();

        this.GameObjectsMapById.forEach((object: GameObject) => {
            let potentials: Body[] = object.Transform.Body.potentials();

            for(let body of potentials) {
                if(object.Transform.Body.collides(body, result)) {
                    object.onCollisionEnter(this.bodyToObjectMap.get(body), result)
                }
            }
        });
    }

    private bodyToObjectMap: Map<Body, GameObject> = new Map<Body, GameObject>();

    public onObjectCreate(gameObject: GameObject) {
        this.collistionsSystem.insert(gameObject.Transform.Body);
        this.bodyToObjectMap.set(gameObject.Transform.Body, gameObject);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.collistionsSystem.remove(gameObject.Transform.Body);
        this.bodyToObjectMap.delete(gameObject.Transform.Body);
    }

    get Width(): number {
        return this.width;
    }

    get Height(): number {
        return this.height;
    }

    deserialize(world: string) {

    }

    serialize(): string {
        return this.width.toString() + ',' + this.height.toString();
    }
}
