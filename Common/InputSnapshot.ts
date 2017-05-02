import {Position} from "../Common/utils/Position";
import {Serializable} from "./net/Serializable";

export class InputSnapshot implements Serializable<InputSnapshot> {
    constructor() {
        this.clear();
    }

    private keysPressed: Set<number>;
    private keysReleased: Set<number>;

    private moveTo: Position;

    public clear() {
        this.keysPressed = new Set<number>();
        this.keysReleased = new Set<number>();
        this.moveTo = new Position()
    }

    public clone(): InputSnapshot {
        let inputSnapshot: InputSnapshot = new InputSnapshot;
        inputSnapshot.ClickPosition = new Position(this.moveTo.X, this.moveTo.Y);
        inputSnapshot.keysReleased = this.keysReleased;
        inputSnapshot.keysPressed = this.keysPressed;

        return inputSnapshot;
    }

    PressKey(keyCode: number) {
        this.keysPressed.add(keyCode);
    }

    ReleaseKey(keyCode: number) {
        this.keysReleased.add(keyCode);
    }

    set ClickPosition(position: Position) {
        this.moveTo = position;
    }

    get ClickPosition(): Position {
        return this.moveTo;
    }

    deserialize(input) {
        this.clear();
        this.moveTo = this.moveTo.deserialize(input.moveTo);
        this.keysReleased = input.keysReleased;
        this.keysPressed = input.keysPressed;

        return this;
    }
}