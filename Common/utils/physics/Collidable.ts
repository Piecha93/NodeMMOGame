import {GameObject} from "../game/GameObject";
import {Cell} from "../physics/SpacialGrid";

export interface Collidable {
    spacialGridCells: Array<Cell>;
    onCollisionEnter(gameObject: GameObject, response?: SAT.Response);
}