import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {SerializableProperty} from "../../../serialize/SerializeDecorators";
import {SerializableTypes} from "../../../serialize/Serializable";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {FireBall} from "./FireBall";

export class Doors extends GameObject {

    @SerializableProperty(ChangesDict.ISOPEN, SerializableTypes.Uint8)
    private isOpen: boolean = false;

    constructor(transform: Transform) {
        super(transform);

        this.isSolid = true;
    }

    protected serverCollision(gameObject: GameObject, result: Result) {
        if(gameObject instanceof FireBall) {
            this.isOpen = !this.isOpen;
            this.addChange(ChangesDict.ISOPEN)
        }
    }

    protected commonCollision(gameObject: GameObject, result: Result) {
        // throw "This method should never be called on Obstacle object";
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if(this.isOpen) {
            this.SpriteName = "doors_open";
            this.isSolid = false;
        } else {
            this.SpriteName = "doors_closed";
            this.isSolid = true;
        }
    }
}