import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {Collider} from "../..//physics/Collider";
import {Collision} from "../../physics/Collision";

export class PlatformTriggerTest extends GameObject {
    constructor(transform: Transform) {
        super(transform);

        this.isChunkDeactivationPersistent = true;

        this.SpriteName = "none";

        let collider: Collider = this.addCollider([transform.ScaleX, transform.ScaleY]);
        collider.IsTriger = true;
    }

    serverOnTriggerEnter(collision: Collision) {
        this.SpriteName = "michau";
    }

    serverOnTriggerExit(collision: Collision) {
        this.SpriteName = "none";
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }
}