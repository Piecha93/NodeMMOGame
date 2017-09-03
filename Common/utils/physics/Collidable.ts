import {Cell} from "../physics/SpacialGrid";
import {Transform} from "../physics/Transform";

export interface Collidable {
    spacialGridCells: Array<Cell>;
    onCollisionEnter(gameObject: Collidable, response?: SAT.Response);
    Transform: Transform
}