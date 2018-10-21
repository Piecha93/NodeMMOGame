/// <reference path="../../node_modules/@types/keypress.js/index.d.ts" />

import {InputSnapshot} from "../../shared/input/InputSnapshot";
import {InputKeyMap} from "./InputKeyMap";
import {INPUT_COMMAND, MouseKeys} from "../../shared/input/InputCommands";
import {Cursor} from "./Cursor";

const keypress = require("keypress.js").keypress;

export class InputHandler {

    private clickPosition: [number, number];
    private mouseButton: number;

    private snapshotCallbacks: Array<Function>;

    private mouseButtonsDown: Map<number, boolean>;

    private cursor: Cursor;

    private listener;

    private inputSnapshot: InputSnapshot;

    private isUp: boolean = false;
    private isDown: boolean = false;
    private isLeft: boolean = false;
    private isRight: boolean = false;

    constructor(cursor: Cursor) {
        console.log(keypress);

        this.listener = new keypress.Listener();
        this.cursor = cursor;

        this.mouseButtonsDown = new Map<number, boolean>();

        this.mouseButtonsDown.set(MouseKeys.LEFT, false);
        this.mouseButtonsDown.set(MouseKeys.MIDDLE, false);
        this.mouseButtonsDown.set(MouseKeys.RIGHT, false);

        this.clickPosition = null;

        this.snapshotCallbacks = [];

        this.inputSnapshot = new InputSnapshot;

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.UP),
            on_keydown: () => {
                this.isUp = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isUp = false;
                this.invokeSnapshotCallbacks();
            }
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.DOWN),
            on_keydown: () => {
                this.isDown = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isDown = false;
                this.invokeSnapshotCallbacks();
            }
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.LEFT),
            on_keydown: () => {
                this.isLeft = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isLeft = false;
                this.invokeSnapshotCallbacks();
            }
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.RIGHT),
            on_keydown: () => {
                this.isRight = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isRight = false;
                this.invokeSnapshotCallbacks();
            }
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.INTERACT),
            prevent_repeat: false,
            on_keydown: () => {
                this.inputSnapshot.append(INPUT_COMMAND.INTERACT, this.cursor.OnObjectId);
                this.invokeSnapshotCallbacks();
            },
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.SWITCH_WEAPON),
            on_keydown: () => {
                this.inputSnapshot.append(INPUT_COMMAND.SWITCH_WEAPON, null);
                this.invokeSnapshotCallbacks();
            },
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.TEST),
            on_keydown: () => {
                this.inputSnapshot.append(INPUT_COMMAND.TEST, this.cursor.Transform.Position);
                this.invokeSnapshotCallbacks();
            },
        });

        window.addEventListener("mousedown", this.onMouseDown.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
        window.addEventListener("contextmenu", (e: PointerEvent): boolean => {
            e.preventDefault();
            return false;
        });
    }

    public addSnapshotCallback(callback: Function) {
        this.snapshotCallbacks.push(callback);
    }

    private onMouseDown(mouseEvent: MouseEvent, isRecursion?: boolean): boolean {
        if(!isRecursion) {
            this.mouseButtonsDown.set(mouseEvent.button, true);
        } else if(!this.mouseButtonsDown.get(mouseEvent.button)) {
            return true;
        }

        this.clickPosition = [this.cursor.Transform.X, this.cursor.Transform.Y];
        this.mouseButton = mouseEvent.button;

        if(this.mouseButtonsDown.get(mouseEvent.button)) {
            setTimeout(() => {
                this.onMouseDown(mouseEvent, true);
            }, 100);
        }

        this.invokeSnapshotCallbacks();

        return true;
    }

    private onMouseUp(mouseEvent: MouseEvent): boolean {
        this.mouseButtonsDown.set(mouseEvent.button, false);
        return true;
    }

    public invokeSnapshotCallbacks() {
        if(this.isUp) {
            this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL, -1);
        } else if(this.isDown) {
            this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL, 1);
        } else {
            this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL, 0);
        }

        if(this.isRight) {
            this.inputSnapshot.append(INPUT_COMMAND.VERTICAL, 1);
        } else if(this.isLeft) {
            this.inputSnapshot.append(INPUT_COMMAND.VERTICAL, -1);
        } else {
            this.inputSnapshot.append(INPUT_COMMAND.VERTICAL, 0);
        }


        if (this.clickPosition != null) {
            if (this.mouseButton == MouseKeys.LEFT) {
                this.inputSnapshot.append(INPUT_COMMAND.LEFT_MOUSE, this.clickPosition.toString());
            } else if (this.mouseButton == MouseKeys.RIGHT) {
                this.inputSnapshot.append(INPUT_COMMAND.RIGHT_MOUSE, this.clickPosition.toString());
            } else {
                this.inputSnapshot.append(INPUT_COMMAND.MIDDLE_MOUSE, this.clickPosition.toString());
            }
            this.clickPosition = null;
        }

        this.inputSnapshot.resetTime();
        this.snapshotCallbacks.forEach((callback: Function) => {
            callback(this.inputSnapshot);
        });

        this.inputSnapshot = new InputSnapshot;
    }
}