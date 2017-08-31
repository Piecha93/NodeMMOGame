import {INPUT_COMMAND} from "../../input/InputCommands";
import {Transform} from "../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../serialize/ChangesDict";
import {CommonConfig, Origin} from "../../CommonConfig";
import {InputSnapshot} from "../../input/InputSnapshot";
import {SpacialGrid} from "../physics/SpacialGrid";
import {Obstacle} from "./Obstacle";
import {ObjectsFactory} from "./ObjectsFactory";

export class Player extends Actor {
    private moveDirection: number = 0;
    private inputHistory: Array<InputSnapshot>;
    private lastInputSnapshot: InputSnapshot;

    constructor(transform: Transform) {
        super(transform);

        this.inputHistory = [];
        this.velocity = 0.8;
    }

    public setInput(inputSnapshot: InputSnapshot) {
        let inputCommands: Map<INPUT_COMMAND, string> = inputSnapshot.Commands;

        if(inputCommands.has(INPUT_COMMAND.MOVE_DIRECTION)) {
            this.moveDirection = parseInt(inputCommands.get(INPUT_COMMAND.MOVE_DIRECTION));
            this.lastInputSnapshot = inputSnapshot;
            if(this.inputHistory.indexOf(inputSnapshot) == -1) {
                this.inputHistory.push(inputSnapshot);
            }
        }

        if(CommonConfig.ORIGIN != Origin.SERVER) {
            return;
        }
        this.inputHistory = [];

        if(inputCommands.has(INPUT_COMMAND.FIRE)) {
            this.shot(parseFloat(inputCommands.get(INPUT_COMMAND.FIRE)));
        }

        if(inputCommands.has(INPUT_COMMAND.WALL)) {
            let o: Obstacle = ObjectsFactory.Instatiate("Obstacle") as Obstacle;
            let splited = inputCommands.get(INPUT_COMMAND.WALL).split(',');
            o.Transform.X = Number(splited[0]) + this.Transform.X;
            o.Transform.Y = Number(splited[1]) + this.Transform.Y;

            this.Transform.addChange(ChangesDict.X);
            this.Transform.addChange(ChangesDict.Y);
        }
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if(this.lastInputSnapshot) {
            this.lastInputSnapshot.setSnapshotDelta();
        }

        let moveFactors: [number, number] = this.parseMoveDir();
        if (moveFactors[0] != 0) {
            this.Transform.X += moveFactors[0] * this.velocity * delta;
            this.Transform.addChange(ChangesDict.X);
        }
        if (moveFactors[1] != 0) {
            this.Transform.Y += moveFactors[1] * this.velocity * delta;
            this.Transform.addChange(ChangesDict.Y);
        }
    }

    public reconciliation(serverSnapshotData: [number, number], spacialGrid: SpacialGrid) {
        let serverSnapshotId: number = serverSnapshotData[0];
        let serverSnapshotDelta: number = serverSnapshotData[1];
        let histElemsToRemove: number = 0;
        for(let i: number = 0; i < this.inputHistory.length; i++) {
            if(this.inputHistory[i].ID >= serverSnapshotId) {
                let delta: number = 0;

                if(i < this.inputHistory.length - 1) {
                    delta = this.inputHistory[i + 1].CreateTime - this.inputHistory[i].CreateTime;
                } else {
                    delta = this.inputHistory[i].SnapshotDelta;
                }
                if(this.inputHistory[i].ID == serverSnapshotId) {
                    delta -= serverSnapshotDelta;
                }
                this.setInput(this.inputHistory[i]);
                let moveFactors: [number, number] = this.parseMoveDir();

                let stepSize = 25;
                let steps: number = Math.floor(delta / stepSize);
                let rest: number = delta % stepSize;

                for (let i = 0; i <= steps; i++) {
                    let step: number;
                    if (i == steps) {
                        step = rest;
                    } else {
                        step = stepSize;
                    }

                    if (this.Transform.DeserializedFields.has(ChangesDict.X)) {
                        this.Transform.X += moveFactors[0] * this.velocity * step;
                    }
                    if (this.Transform.DeserializedFields.has(ChangesDict.Y)) {
                        this.Transform.Y += moveFactors[1] * this.velocity * step;
                    }
                    spacialGrid.insertObjectIntoGrid(this);
                    for (let cell of this.spacialGridCells) {
                        cell.checkCollisionsForObject(this);
                    }
                }
            } else {
                histElemsToRemove++
            }
        }
        this.inputHistory = this.inputHistory.splice(histElemsToRemove);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    private parseMoveDir(): [number, number] {
        let xFactor: number = 0;
        let yFactor: number = 0;
        if(this.moveDirection != 0) {
            if (this.moveDirection == 1) {
                yFactor = -1;
            } else if (this.moveDirection == 2) {
                xFactor = 0.7071;
                yFactor = -0.7071;
            } else if (this.moveDirection == 3) {
                xFactor = 1;
            } else if (this.moveDirection == 4) {
                xFactor = 0.7071;
                yFactor = 0.7071;
            } else if (this.moveDirection == 5) {
                yFactor = 1;
            } else if (this.moveDirection == 6) {
                xFactor = -0.7071;
                yFactor = 0.7071;
            } else if (this.moveDirection == 7) {
                xFactor = -1;
            } else if (this.moveDirection == 8) {
                xFactor = -0.7071;
                yFactor = -0.7071;
            }
        }
        return [xFactor, yFactor]
    }

    get LastInputSnapshot(): InputSnapshot{
        return this.lastInputSnapshot;
    }

    set Direction(direction: number) {
        if(direction >= 0 && direction <= 8) {
            this.moveDirection = direction;
        }
    }

    get Direction(): number {
        return this.moveDirection;
    }
}

