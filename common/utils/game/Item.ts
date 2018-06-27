import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {Result} from "detect-collisions";

export class Item extends GameObject {
    private isClaimed: boolean = false;

    constructor(transform: Transform) {
        super(transform);

        this.spriteName = "hp_potion";
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
        super.serverCollision(gameObject, result);
        this.destroy();
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        super.commonCollision(gameObject, result);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }

    public Claim(): boolean {
        if(this.isClaimed == false) {
            this.isClaimed = true;
            return true;
        }

        return false;
    }
}