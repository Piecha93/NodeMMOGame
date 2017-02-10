/// <reference path="libs/@types/phaser.d.ts" />

import Pointer = Phaser.Pointer;
import {Position} from "./utils/Position";

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

export class InputHandler {
    private phaserInput: Phaser.Input;
    private inputSnapshot: InputSnapshot;
    private changed: boolean;

    constructor(phaserInput: Phaser.Input) {
        // document.addEventListener("keydown", this.keyPressed);
        // document.addEventListener("keyup", this.keyReleased);

        this.inputSnapshot = new InputSnapshot;
        this.changed = false;

        this.phaserInput = phaserInput;
        this.phaserInput.onDown.add(this.mouseClick, this)
        //this.phaserInput.addMoveCallback(this.mouseClick, this);
    }

    private keyPressed(event : KeyboardEvent) {
        console.log(event.keyCode);
    }

    private keyReleased(event : KeyboardEvent) {
        console.log(event.keyCode);
    }

    public mouseClick(mouseEvent: MouseEvent) {
        let position: Position = new Position(mouseEvent.x, mouseEvent.y);
        this.inputSnapshot.MoveTo = position;

        this.changed = true;
    }

    public cloneInputSnapshot(): InputSnapshot {
        this.changed = false;
        let inputSnapshotCopy: InputSnapshot = this.inputSnapshot.clone();;
        this.inputSnapshot.clear();
        return inputSnapshotCopy;
    }

    get Changed(): boolean {
        return this.changed;
    }
}