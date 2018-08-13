import {InputSnapshot} from "../../common/input/InputSnapshot";
import {INPUT, InputMap} from "./InputMap";
import {INPUT_COMMAND} from "../../common/input/InputCommands";
import {Cursor} from "./Cursor";


export class InputHandler {
    private releasedKeys: Set<string>;
    private clickPosition: [number, number];
    private mousePosition: [number, number];
    private mouseButton: number;
    private lastDirection: number = 0;

    private snapshotCallbacks: Array<Function>;
    private pressedKeys: Set<string>;

    private cursor: Cursor;

    constructor(cursor: Cursor) {
        this.cursor = cursor;

        this.pressedKeys = new Set<string>();
        this.releasedKeys = new Set<string>();
        this.clickPosition = null;
        this.mousePosition = [0,0];

        this.snapshotCallbacks = [];

        document.addEventListener("keydown", this.onKeyDown.bind(this));
        document.addEventListener("keyup", this.onKeyUp.bind(this));

        window.addEventListener("mousedown", this.onMouseClick.bind(this));
        window.addEventListener("mousemove", this.onMouseMove.bind(this));
        window.addEventListener("contextmenu", (e: PointerEvent): boolean => {
            // console.log("win context menu");
            // console.log(e);
            e.preventDefault();
            return false;
        });
    }

    public addSnapshotCallback(callback: Function) {
        this.snapshotCallbacks.push(callback);
    }


    private onKeyDown(event : KeyboardEvent) {
        if(InputMap.has(event.code) && !this.pressedKeys.has(event.code)) {
            this.releasedKeys.delete(event.code);
            this.pressedKeys.add(event.code);
            this.invokeSnapshotCallbacks();
        }
    }

    private onKeyUp(event : KeyboardEvent) {
        if(InputMap.has(event.code) && this.pressedKeys.has(event.code)) {
            this.pressedKeys.delete(event.code);
            this.releasedKeys.add(event.code);
            this.invokeSnapshotCallbacks();
        }
    }

    private onMouseClick(mouseEvent: MouseEvent): boolean {
        this.clickPosition = [this.cursor.Transform.X, this.cursor.Transform.Y];
        this.mouseButton = mouseEvent.button;

        this.invokeSnapshotCallbacks();

        return true;
    }

    private onMouseMove(mouseEvent: MouseEvent) {
        let canvas: HTMLCanvasElement = document.getElementById("game-canvas") as HTMLCanvasElement;
        let rect: ClientRect = canvas.getBoundingClientRect();
        this.mousePosition = [mouseEvent.x - rect.width/2 - rect.left, mouseEvent.y - rect.height/2 - rect.top];
    }

    public invokeSnapshotCallbacks() {
        let snapshot: InputSnapshot = this.createInputSnapshot();
        if (snapshot.Commands.size == 0) {
            return;
        }

        this.snapshotCallbacks.forEach((callback: Function) => {
            callback(snapshot);
        });
    }

    private createInputSnapshot(): InputSnapshot {
        let inputSnapshot: InputSnapshot = new InputSnapshot;

        let directionBuffor: Array<INPUT> = [];
        this.pressedKeys.forEach((key: string) => {
            let input: INPUT = InputMap.get(key);

            if(input == INPUT.UP || input == INPUT.DOWN || input == INPUT.LEFT || input == INPUT.RIGHT) {
                directionBuffor.push(input);
            }

            if(input == INPUT.WALL) {
                inputSnapshot.append(INPUT_COMMAND.WALL, this.mousePosition.toString())
            }
        });

        let newDirection: number = this.parseDirection(directionBuffor);
        this.lastDirection = newDirection;
        inputSnapshot.append(INPUT_COMMAND.MOVE_DIRECTION, newDirection.toString());

        if(this.clickPosition != null) {
            if(this.mouseButton == 0) {
                inputSnapshot.append(INPUT_COMMAND.LEFT_MOUSE, this.clickPosition.toString());
            } else {
                inputSnapshot.append(INPUT_COMMAND.RIGHT_MOUSE, this.clickPosition.toString());
            }
            this.clickPosition = null;
        }

        this.releasedKeys.clear();

        return inputSnapshot;
    }

    private parseDirection(directionBuffor: Array<INPUT>): number {
        let direction: number = 0;
        if(directionBuffor.indexOf(INPUT.UP) != -1 && directionBuffor.indexOf(INPUT.RIGHT) != -1) {
            direction = 2;
        } else if(directionBuffor.indexOf(INPUT.DOWN) != -1 && directionBuffor.indexOf(INPUT.RIGHT) != -1) {
            direction = 4;
        } else if(directionBuffor.indexOf(INPUT.DOWN) != -1 && directionBuffor.indexOf(INPUT.LEFT) != -1) {
            direction = 6;
        } else if(directionBuffor.indexOf(INPUT.UP) != -1 && directionBuffor.indexOf(INPUT.LEFT) != -1) {
            direction = 8;
        } else if(directionBuffor.indexOf(INPUT.UP) != -1) {
            direction = 1;
        } else if(directionBuffor.indexOf(INPUT.RIGHT) != -1) {
            direction = 3;
        } else if(directionBuffor.indexOf(INPUT.LEFT) != -1) {
            direction = 7;
        } else if(directionBuffor.indexOf(INPUT.DOWN) != -1) {
            direction = 5;
        }

        return direction;
    }
}