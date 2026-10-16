import { GameObject } from "./GameObject";
import { Transform } from "../../physics/Transform";
import { Result } from "detect-collisions";
import { ChangesDict } from "../../../core/ChangeKeys";

export class Doors extends GameObject {
    private isOpen: boolean = false;

    constructor(transform: Transform) {
        super(transform);

        this.isChunkDeactivationPersistent = true;
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if (this.isOpen) {
            this.SpriteName = "doors_open";
        } else {
            this.SpriteName = "doors_closed";
        }
    }

    override get IsSolid(): boolean {
        return !this.isOpen;
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
