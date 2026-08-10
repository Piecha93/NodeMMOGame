import {InputSnapshot} from "../../shared/input/InputSnapshot";
import {InputKeyMap} from "./InputKeyMap";
import {INPUT_COMMAND, MouseKeys} from "../../shared/input/InputCommands";
import {Cursor} from "./Cursor";

export class InputHandler {

    private clickPosition: [number, number];
    private mouseButton: number;

    private snapshotCallbacks: Array<Function>;

    private mouseButtonsDown: Map<number, boolean>;

    private cursor: Cursor;

    private inputSnapshot: InputSnapshot;

    private isUp: boolean = false;
    private isDown: boolean = false;
    private isLeft: boolean = false;
    private isRight: boolean = false;

    constructor(cursor: Cursor) {
        this.cursor = cursor;

        this.mouseButtonsDown = new Map<number, boolean>();

        this.mouseButtonsDown.set(MouseKeys.LEFT, false);
        this.mouseButtonsDown.set(MouseKeys.MIDDLE, false);
        this.mouseButtonsDown.set(MouseKeys.RIGHT, false);

        this.clickPosition = null;

        this.snapshotCallbacks = [];

        this.inputSnapshot = new InputSnapshot;

        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onWindowBlur);
        window.addEventListener("mousedown", this.onMouseDown.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
        window.addEventListener("contextmenu", (e: PointerEvent): boolean => {
            e.preventDefault();
            return false;
        });
    }

    private onKeyDown = (event: KeyboardEvent) => {
        if (this.isTextEntryTarget(event.target)) {
            return;
        }

        const command = this.getCommandForKey(event.key);
        if (command === undefined) {
            return;
        }

        if (event.repeat && this.isMovementCommand(command)) {
            return;
        }

        if (this.setMovementState(command, true)) {
            this.invokeSnapshotCallbacks();
            return;
        }

        if (command === INPUT_COMMAND.INTERACT) {
            this.inputSnapshot.append(command, this.cursor.OnObjectId);
        } else if (command === INPUT_COMMAND.SWITCH_WEAPON) {
            this.inputSnapshot.append(command, null);
        } else if (command === INPUT_COMMAND.TEST) {
            this.inputSnapshot.append(command, this.cursor.Transform.Position);
        } else {
            return;
        }

        this.invokeSnapshotCallbacks();
    };

    private onKeyUp = (event: KeyboardEvent) => {
        const command = this.getCommandForKey(event.key);
        if (command !== undefined && this.setMovementState(command, false)) {
            this.invokeSnapshotCallbacks();
        }
    };

    private onWindowBlur = () => {
        if (!this.isUp && !this.isDown && !this.isLeft && !this.isRight) {
            return;
        }

        this.isUp = false;
        this.isDown = false;
        this.isLeft = false;
        this.isRight = false;
        this.invokeSnapshotCallbacks();
    };

    private isTextEntryTarget(target: EventTarget | null): boolean {
        return target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLElement && target.isContentEditable;
    }

    private getCommandForKey(key: string): INPUT_COMMAND | undefined {
        const normalizedKey = key.toLowerCase();
        for (const [command, mappedKey] of InputKeyMap) {
            if (mappedKey === normalizedKey) {
                return command;
            }
        }

        return undefined;
    }

    private setMovementState(command: INPUT_COMMAND, isPressed: boolean): boolean {
        let wasPressed: boolean;

        if (command === INPUT_COMMAND.UP) {
            wasPressed = this.isUp;
            this.isUp = isPressed;
        } else if (command === INPUT_COMMAND.DOWN) {
            wasPressed = this.isDown;
            this.isDown = isPressed;
        } else if (command === INPUT_COMMAND.LEFT) {
            wasPressed = this.isLeft;
            this.isLeft = isPressed;
        } else if (command === INPUT_COMMAND.RIGHT) {
            wasPressed = this.isRight;
            this.isRight = isPressed;
        } else {
            return false;
        }

        return wasPressed !== isPressed;
    }

    private isMovementCommand(command: INPUT_COMMAND): boolean {
        return command === INPUT_COMMAND.UP ||
            command === INPUT_COMMAND.DOWN ||
            command === INPUT_COMMAND.LEFT ||
            command === INPUT_COMMAND.RIGHT;
    }

    public addSnapshotCallback(callback: Function) {
        this.snapshotCallbacks.push(callback);
    }

    private onMouseDown(mouseEvent: MouseEvent, isRecursion?: boolean): boolean {
        if (!isRecursion && this.isTextEntryTarget(mouseEvent.target)) {
            return true;
        }

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
