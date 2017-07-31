import {GameObject} from "../game/GameObject";

export interface Collidable {
    onCollisionEnter(gameObject: GameObject, response?: SAT.Response);
}