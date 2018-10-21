/// <reference path="../../node_modules/@types/keypress.js/index.d.ts" />

import {InputSnapshot} from "../../shared/input/InputSnapshot";
import {InputKeyMap} from "./InputKeyMap";
import {INPUT_COMMAND} from "../../shared/input/InputCommands";
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

    constructor(cursor: Cursor) {
        console.log(keypress);

        this.listener = new keypress.Listener();
        this.cursor = cursor;

        this.mouseButtonsDown = new Map<number, boolean>();

        //TODO change 0,1,2 to proper enum
        this.mouseButtonsDown.set(0, false);
        this.mouseButtonsDown.set(1, false);
        this.mouseButtonsDown.set(2, false);

        this.clickPosition = null;

        this.snapshotCallbacks = [];

        this.inputSnapshot = new InputSnapshot;

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.HORIZONTAL_UP),
            on_keydown: () => {
                this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL_UP, -1);
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL_UP, 0);
                this.invokeSnapshotCallbacks();
            }
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.HORIZONTAL_DOWN),
            on_keydown: () => {
                this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL_DOWN, 1);
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL_DOWN, 0);
                this.invokeSnapshotCallbacks();
            }
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.VERTICAL_LEFT),
            on_keydown: () => {
                this.inputSnapshot.append(INPUT_COMMAND.VERTICAL_LEFT, -1);
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.inputSnapshot.append(INPUT_COMMAND.VERTICAL_LEFT, 0);
                this.invokeSnapshotCallbacks();
            }
        });

        this.listener.register_combo({
            keys: InputKeyMap.get(INPUT_COMMAND.VERTICAL_RIGHT),
            on_keydown: () => {
                this.inputSnapshot.append(INPUT_COMMAND.VERTICAL_RIGHT, 1);
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.inputSnapshot.append(INPUT_COMMAND.VERTICAL_RIGHT, 0);
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
        this.clickPosition = [this.cursor.Transform.X, this.cursor.Transform.Y];
        if(!isRecursion) {
            this.mouseButtonsDown.set(mouseEvent.button, true);
        } else if(!this.mouseButtonsDown.get(mouseEvent.button)) {
            return true;
        }

        this.mouseButton = mouseEvent.button;

        this.invokeSnapshotCallbacks();


        if(this.mouseButtonsDown.get(mouseEvent.button)) {
            setTimeout(() => {
                this.onMouseDown(mouseEvent, true);
            }, 100);
        }

        return true;
    }

    private onMouseUp(mouseEvent: MouseEvent): boolean {
        this.mouseButtonsDown.set(mouseEvent.button, false);
        return true;
    }

    public invokeSnapshotCallbacks() {
        if (this.clickPosition != null) {
            if (this.mouseButton == 0) {
                this.inputSnapshot.append(INPUT_COMMAND.LEFT_MOUSE, this.clickPosition.toString());
            } else if (this.mouseButton == 2) {
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