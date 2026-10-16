import { InputSnapshot } from "../../shared/input/InputSnapshot";
import { InputKeyMap } from "./InputKeyMap";
import { INPUT_COMMAND, MouseKeys } from "../../shared/input/InputCommands";
import { Cursor } from "./Cursor";

export class InputHandler {
    private clickPosition: [number, number] | null;
    private mouseButton: number = MouseKeys.LEFT;

    private snapshotCallbacks: Array<(snapshot: InputSnapshot) => void>;
    private readonly mouseTimers = new Map<number, ReturnType<typeof setTimeout>>();
    private disposed = false;
    private readonly mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
    private readonly mouseUpHandler = (event: MouseEvent) => this.onMouseUp(event);
    private readonly contextMenuHandler = (event: Event) => {
        if (!this.isInterfaceTarget(event.target)) event.preventDefault();
    };

    private mouseButtonsDown: Map<number, boolean>;

    private cursor: Cursor;

    private inputSnapshot: InputSnapshot;

    private isUp: boolean = false;
    private isDown: boolean = false;
    private isLeft: boolean = false;
    private isRight: boolean = false;

    constructor(
        cursor: Cursor,
        private readonly beforeAim: (event?: MouseEvent) => void = () => {},
    ) {
        this.cursor = cursor;

        this.mouseButtonsDown = new Map<number, boolean>();

        this.mouseButtonsDown.set(MouseKeys.LEFT, false);
        this.mouseButtonsDown.set(MouseKeys.MIDDLE, false);
        this.mouseButtonsDown.set(MouseKeys.RIGHT, false);

        this.clickPosition = null;

        this.snapshotCallbacks = [];

        this.inputSnapshot = new InputSnapshot();

        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onWindowBlur);
        window.addEventListener("mousedown", this.mouseDownHandler);
        window.addEventListener("mouseup", this.mouseUpHandler);
        window.addEventListener("contextmenu", this.contextMenuHandler);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onWindowBlur);
        window.removeEventListener("mousedown", this.mouseDownHandler);
        window.removeEventListener("mouseup", this.mouseUpHandler);
        window.removeEventListener("contextmenu", this.contextMenuHandler);
        this.resetMouse();
        this.snapshotCallbacks = [];
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
            const target = this.cursor.OnObjectId;
            if (target === null) return;
            this.inputSnapshot.append(command, target);
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
        this.resetMouse();
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
        return (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            (target instanceof HTMLElement &&
                (target.isContentEditable || target.tagName === "SELECT" || target.tagName === "OPTION"))
        );
    }

    private isInterfaceTarget(target: EventTarget | null): boolean {
        return (
            this.isTextEntryTarget(target) ||
            (target instanceof HTMLElement &&
                typeof target.closest === "function" &&
                target.closest("button, a, form, [data-game-ui]") !== null)
        );
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
        return (
            command === INPUT_COMMAND.UP ||
            command === INPUT_COMMAND.DOWN ||
            command === INPUT_COMMAND.LEFT ||
            command === INPUT_COMMAND.RIGHT
        );
    }

    public addSnapshotCallback(callback: (snapshot: InputSnapshot) => void) {
        this.snapshotCallbacks.push(callback);
    }

    private onMouseDown(mouseEvent: MouseEvent): boolean {
        if (
            this.disposed ||
            this.isInterfaceTarget(mouseEvent.target) ||
            !this.mouseButtonsDown.has(mouseEvent.button)
        ) {
            return true;
        }
        if (this.mouseButtonsDown.get(mouseEvent.button)) return true;
        this.mouseButtonsDown.set(mouseEvent.button, true);
        this.repeatMouse(mouseEvent.button, mouseEvent);
        return true;
    }

    private repeatMouse(button: number, event?: MouseEvent): void {
        this.mouseTimers.delete(button);
        if (this.disposed || !this.mouseButtonsDown.get(button)) return;
        this.beforeAim(event);
        this.clickPosition = [this.cursor.Transform.X, this.cursor.Transform.Y];
        this.mouseButton = button;
        this.invokeSnapshotCallbacks();
        if (!this.disposed && this.mouseButtonsDown.get(button)) {
            this.mouseTimers.set(
                button,
                setTimeout(() => this.repeatMouse(button), 100),
            );
        }
    }

    private onMouseUp(mouseEvent: MouseEvent): boolean {
        this.mouseButtonsDown.set(mouseEvent.button, false);
        const timer = this.mouseTimers.get(mouseEvent.button);
        if (timer !== undefined) clearTimeout(timer);
        this.mouseTimers.delete(mouseEvent.button);
        return true;
    }

    private resetMouse(): void {
        for (const timer of this.mouseTimers.values()) clearTimeout(timer);
        this.mouseTimers.clear();
        for (const button of this.mouseButtonsDown.keys()) this.mouseButtonsDown.set(button, false);
        this.clickPosition = null;
    }

    public invokeSnapshotCallbacks() {
        if (this.disposed) return;
        if (this.isUp) {
            this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL, -1);
        } else if (this.isDown) {
            this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL, 1);
        } else {
            this.inputSnapshot.append(INPUT_COMMAND.HORIZONTAL, 0);
        }

        if (this.isRight) {
            this.inputSnapshot.append(INPUT_COMMAND.VERTICAL, 1);
        } else if (this.isLeft) {
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
        this.snapshotCallbacks.forEach((callback) => {
            callback(this.inputSnapshot);
        });

        this.inputSnapshot = new InputSnapshot();
    }
}
