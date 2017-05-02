/// <reference path="libs/@types/phaser.d.ts" />

import Pointer = Phaser.Pointer;
import {Position} from "../Common/utils/Position";
import {InputSnapshot} from "../Common/InputSnapshot";

export class InputHandler {
    private phaserInput: Phaser.Input;
    private inputSnapshot: InputSnapshot;
    private changed: boolean;

    constructor(phaserInput: Phaser.Input) {
        document.addEventListener("keydown", this.keyPressed.bind(this));
        document.addEventListener("keyup", this.keyReleased.bind(this));

        this.inputSnapshot = new InputSnapshot;
        this.changed = false;

        this.phaserInput = phaserInput;
        this.phaserInput.onDown.add(this.mouseClick, this);
        //this.phaserInput.addMoveCallback(this.mouseClick, this);
    }

     private keyPressed(event : KeyboardEvent) {
         //console.log("keyPressed " + event.keyCode);
         this.inputSnapshot.PressKey(event.keyCode);
         //this.changed = true;
     }

     private keyReleased(event : KeyboardEvent) {
         //console.log("keyReleased " + event.keyCode);
         this.inputSnapshot.ReleaseKey(event.keyCode);
         //this.changed = true;
     }

    public mouseClick(mouseEvent: MouseEvent) {
        this.inputSnapshot.ClickPosition = new Position(mouseEvent.x, mouseEvent.y);

        this.changed = true;
    }

    public cloneInputSnapshot(): InputSnapshot {
        this.changed = false;
        let inputSnapshotCopy: InputSnapshot = this.inputSnapshot.clone();
        this.inputSnapshot.clear();
        return inputSnapshotCopy;
    }

    get Changed(): boolean {
        return this.changed;
    }
}