import {Cell} from "./SpatialGrid";
import {Transform} from "../physics/Transform";

export interface Collidable {
    spatialGridCells: Array<Cell>;
    onCollisionEnter(gameObject: Collidable, response?: SAT.Response);
    Transform: Transform
}