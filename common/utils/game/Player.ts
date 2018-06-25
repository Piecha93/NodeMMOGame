import {INPUT_COMMAND} from "../../input/InputCommands";
import {Transform} from "../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../serialize/ChangesDict";
import {CommonConfig} from "../../CommonConfig";
import {InputSnapshot} from "../../input/InputSnapshot";
import {CollisionsSystem} from "..//physics/CollisionsSystem";
import {PropName} from "../../serialize/NetworkDecorators";
import {byteSize} from "../functions/BitOperations";

export class Player extends Actor {
    private moveDirection: number = 0;
    private inputHistory: Array<InputSnapshot>;
    private lastInputSnapshot: InputSnapshot;

    private static onlyServerActions: Set<INPUT_COMMAND> = new Set<INPUT_COMMAND>([
        INPUT_COMMAND.FIRE,
        INPUT_COMMAND.WALL
    ]);

    public serialize(updateBufferView: DataView, offset: number, complete: boolean = false): number {
        let propsSize: number = (this[PropName.SerializeEncodeOrder] as Map<string, number>).size;
        let propsByteSize: number = byteSize(propsSize);

        console.log("propsByteSize for player " + propsByteSize);

        return super.serialize(updateBufferView, offset, complete);
    }


        constructor(transform: Transform) {
        super(transform);

        this.inputHistory = [];
        this.velocity = 0.5;
    }

    private pushSnapshotToHistory(inputSnapshot: InputSnapshot) {
        this.lastInputSnapshot = inputSnapshot;
        //only client need snapshots history
        if(CommonConfig.IS_CLIENT) {
            if(this.inputHistory.indexOf(inputSnapshot) == -1) {
                this.inputHistory.push(inputSnapshot);
            }
        }
    }

    public setInput(inputSnapshot: InputSnapshot) {
        let inputCommands: Map<INPUT_COMMAND, string> = inputSnapshot.Commands;

        inputCommands.forEach((value: string, key: INPUT_COMMAND) => {
            if (CommonConfig.IS_CLIENT && Player.onlyServerActions.has(key)) return;

            if(key == INPUT_COMMAND.MOVE_DIRECTION) {
                this.moveDirectionAction(value);
                this.pushSnapshotToHistory(inputSnapshot);
            } else if(key == INPUT_COMMAND.FIRE) {
                this.fireAction(value);
            } else if(key == INPUT_COMMAND.WALL) {
                this.wallAction(value);
            }
        });
    }

    private moveDirectionAction(direction: string) {
        this.moveDirection = parseInt(direction);
    }

    private fireAction(angle: string) {
        this.shot(parseFloat(angle));
        for(let i = 0; i < 30; i++) {
            this.shot(Math.floor(Math.random() * 360));
        }
    }

    private wallAction(coords) {
        // FOR TEST

        // let o: Obstacle = GameObjectsFactory.Instatiate("Obstacle") as Obstacle;
        // let splited = value.split(',');
        // o.Transform.X = Number(splited[0]) + this.Transform.X;
        // o.Transform.Y = Number(splited[1]) + this.Transform.Y;
        //
        // this.Transform.addChange(ChangesDict.X);
        // this.Transform.addChange(ChangesDict.Y);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if(this.lastInputSnapshot) {
            this.lastInputSnapshot.setSnapshotDelta();
        }

        this.updatePosition(delta);
    }

    protected updatePosition(delta: number) {
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

    public reconciliation(serverSnapshotData: [number, number], collisionsSystem: CollisionsSystem) {
        let serverSnapshotId: number = serverSnapshotData[0];
        let serverSnapshotDelta: number = serverSnapshotData[1];
        let histElemsToRemove: number = 0;

        for(let i: number = 0; i < this.inputHistory.length; i++) {
            if(this.inputHistory[i].ID < serverSnapshotId) {
                histElemsToRemove++;
                continue;
            }
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

                let moveFactors: [number, number] = this.parseMoveDir();

                if (this.Transform.DeserializedFields.has(ChangesDict.X)) {
                    this.Transform.X += moveFactors[0] * this.velocity * step;
                }
                if (this.Transform.DeserializedFields.has(ChangesDict.Y)) {
                    this.Transform.Y += moveFactors[1] * this.velocity * step;
                }

                collisionsSystem.updateCollisionsForObject(this);
            }
        }
        this.inputHistory = this.inputHistory.splice(histElemsToRemove);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    private static cornerDir: number = 0.7071;

    private static moveDirsX = [0, 0, Player.cornerDir, 1, Player.cornerDir, 0, -Player.cornerDir, -1, -Player.cornerDir];
    private static moveDirsY = [0, -1, -Player.cornerDir, 0, Player.cornerDir, 1, Player.cornerDir, 0, -Player.cornerDir];

    private parseMoveDir(): [number, number] {
        return [Player.moveDirsX[this.moveDirection], Player.moveDirsY[this.moveDirection]]
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

