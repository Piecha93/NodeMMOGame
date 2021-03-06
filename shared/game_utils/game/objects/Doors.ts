import {GameObject} from "./GameObject";
import {Transform} from "../../physics/Transform";
import {Result} from "detect-collisions";
import {SerializableProperty} from "../../../serialize/SerializeDecorators";
import {SerializableTypes} from "../../../serialize/Serializable";
import {ChangesDict} from "../../../serialize/ChangesDict";


export class Doors extends GameObject {

    @SerializableProperty(ChangesDict.ISOPEN, SerializableTypes.Uint8)
    private isOpen: boolean = false;

    constructor(transform: Transform) {
        super(transform);

        this.isSolid = true;
        this.isChunkDeactivationPersistent = true;
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

    open() {
        this.isOpen = !this.isOpen;
        this.addChange(ChangesDict.ISOPEN);
    }

    interact() {
        this.open();
    }

    get InteractPopUpMessage(): string {
        return "Open";
    }
}