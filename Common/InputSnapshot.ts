import {Position} from "../Common/utils/Position";

export class InputSnapshot {
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
        inputSnapshot.MoveTo = new Position(this.moveTo.X, this.moveTo.Y);

        return inputSnapshot;
    }

    set MoveTo(position: Position) {
        this.moveTo = position;
    }

    get MoveTo(): Position {
        return this.moveTo;
    }
}