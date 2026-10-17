import { GameObject } from "./GameObject";
import { Transform } from "../../physics/Transform";

/** Static expedition landmarks; objectives are owned by the server scenario. */
export class ExpeditionMarker extends GameObject {
    /** Consumable run loot must never be restored from a sleeping chunk dump. */
    configureLoot(): void {
        this.isChunkDeactivationPersistent = false;
    }

    constructor(transform: Transform) {
        super(transform);
        this.isChunkDeactivationPersistent = true;
        this.isCollisionStatic = true;
        for (const collider of this.Colliders) collider.IsTriger = true;
    }
}
