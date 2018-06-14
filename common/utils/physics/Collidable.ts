import {Transform} from "../physics/Transform";

export interface Collidable {
    onCollisionEnter(gameObject: Collidable, response?: SAT.Response);
    Transform: Transform
}