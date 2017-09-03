import {InputSnapshot} from "../../Common/input/InputSnapshot";
import {INPUT, InputMap} from "./InputMap";
import {INPUT_COMMAND} from "../../Common/input/InputCommands";

export class InputHandler {
    private releasedKeys: Set<number>;
    private clickPosition: [number, number];
    private mousePosition: [number, number];
    private lastDirection: number = 0;

    private snapshotCallbacks: Array<Function>;
    private pressedKeys: Set<number>;

    constructor() {
        this.pressedKeys =  new Set<number>();
        this.releasedKeys =  new Set<number>();
        this.clickPosition = null;
        this.mousePosition = [0,0];

        this.snapshotCallbacks = [];

        document.addEventListener("keydown", this.onKeyDown.bind(this));
        document.addEventListener("keyup", this.onKeyUp.bind(this));

        window.addEventListener("mousedown", this.onMouseClick.bind(this));
        window.addEventListener("mousemove", this.onMouseMove.bind(this));

    }

    public addSnapshotCallback(callback: Function) {
        this.snapshotCallbacks.push(callback);
    }


    private onKeyDown(event : KeyboardEvent) {
        if(InputMap.has(event.keyCode) && !this.pressedKeys.has(event.keyCode)) {
            this.releasedKeys.delete(event.keyCode);
            this.pressedKeys.add(event.keyCode);
            this.invokeSnapshotCallbacks();
        }
    }

    private onKeyUp(event : KeyboardEvent) {
        if(InputMap.has(event.keyCode) && this.pressedKeys.has(event.keyCode)) {
            this.pressedKeys.delete(event.keyCode);
            this.releasedKeys.add(event.keyCode);
            this.invokeSnapshotCallbacks();
        }
    }

    private onMouseClick(mouseEvent: MouseEvent) {
        let canvas: HTMLCanvasElement = document.getElementById("game-canvas") as HTMLCanvasElement;
        let rect: ClientRect = canvas.getBoundingClientRect();
        this.clickPosition = [mouseEvent.x - rect.left, mouseEvent.y - rect.top];

        this.invokeSnapshotCallbacks();
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
        this.pressedKeys.forEach((key: number) => {
            let input: INPUT = InputMap.get(key);

            if(input == INPUT.UP || input == INPUT.DOWN || input == INPUT.LEFT || input == INPUT.RIGHT) {
                directionBuffor.push(input);
            }

            if(input == INPUT.WALL) {
                console.log(this.mousePosition);
                inputSnapshot.append(INPUT_COMMAND.WALL, this.mousePosition.toString())
            }
        });

        let newDirection: number = this.parseDirection(directionBuffor);
        this.lastDirection = newDirection;
        inputSnapshot.append(INPUT_COMMAND.MOVE_DIRECTION, newDirection.toString());

        if(this.clickPosition != null) {
            let angle: string = this.parseClick();
            inputSnapshot.append(INPUT_COMMAND.FIRE, angle);
            this.clickPosition = null;
        }

        this.releasedKeys.clear();

        return inputSnapshot;
    }

    private parseClick(): string {
        let canvas: HTMLCanvasElement = document.getElementById("game-canvas") as HTMLCanvasElement;

        let centerX = canvas.width / 2;
        let centerY = canvas.height / 2;
        let deltaX = this.clickPosition[0] - centerX;
        let deltaY = this.clickPosition[1] - centerY;
        let angle: number = Math.atan2(deltaY, deltaX);
        if (angle < 0)
            angle = angle + 2*Math.PI;

        return angle.toString();
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