import { GameObject } from "./GameObject";
import { Transform } from "../../physics/Transform";
import { Player } from "./Player";
import { Collision } from "../../physics/Collision";

export class Item extends GameObject {
    private consumed = false;
    constructor(transform: Transform) {
        super(transform);
    }

    protected serverOnCollisionEnter(collision: Collision) {
        const player = collision.ColliderB.Parent;
        if (!(player instanceof Player) || player.HP <= 0 || player.HP >= player.MaxHP) return;
        player.heal(50);
        this.consumed = true;
        this.destroy();
    }

    protected serverOnCollisionStay(collision: Collision) {
        this.serverOnCollisionEnter(collision);
    }

    get Consumed(): boolean {
        return this.consumed;
    }
}
