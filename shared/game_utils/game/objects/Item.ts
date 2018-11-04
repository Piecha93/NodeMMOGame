import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {Actor} from "./Actor";
import {Collision} from "../../physics/Collision";

export class Item extends GameObject {
    constructor(transform: Transform) {
        super(transform);
    }

    protected serverOnCollisionEnter(collision: Collision) {
        super.serverOnCollisionEnter(collision);

        let gameObject: GameObject = collision.ColliderB.Parent;
        if(gameObject instanceof Actor) {
            gameObject.heal(50)
        }
        this.destroy();
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }
}