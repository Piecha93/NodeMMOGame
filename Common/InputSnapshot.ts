import {Position} from "../Common/utils/Position";
import {Serializable} from "./net/Serializable";

export class InputSnapshot implements Serializable<InputSnapshot> {
    constructor() {
        this.clear();
    }

    private keysPressed: Array<number>;
    private keysReleased: Array<number>;

    private moveTo: Position;

    public clear() {
        this.keysPressed = [];
        this.keysReleased = [];

        this.keysPressed = null;
    }

    public clone(): InputSnapshot {
        let inputSnapshot: InputSnapshot = new InputSnapshot;
        inputSnapshot.ClickPosition = new Position(this.moveTo.X, this.moveTo.Y);

        return inputSnapshot;
    }

    set ClickPosition(position: Position) {
        this.moveTo = position;
    }

    get ClickPosition(): Position {
        return this.moveTo;
    }

    deserialize(input) {
        if(this.moveTo) {
            this.moveTo = this.moveTo.deserialize(input.moveTo);
        } else {
            this.moveTo = new Position().deserialize(input.moveTo);
        }
        return this;
    }
}