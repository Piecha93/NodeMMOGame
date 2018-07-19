import {INPUT_COMMAND} from "../../input/InputCommands";
import {Transform} from "../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../serialize/ChangesDict";
import {CommonConfig} from "../../CommonConfig";
import {InputSnapshot} from "../../input/InputSnapshot";
import {CollisionsSystem} from "..//physics/CollisionsSystem";
import {PortalGun} from "./PortalGun";

export class Player extends Actor {
    private inputHistory: Array<InputSnapshot>;
    private lastInputSnapshot: InputSnapshot;
    private lastServerSnapshotData: [number, number];

    private static onlyServerActions: Set<INPUT_COMMAND> = new Set<INPUT_COMMAND>([
        INPUT_COMMAND.FIRE,
        INPUT_COMMAND.FIRE_2,
        INPUT_COMMAND.WALL
    ]);


    constructor(transform: Transform) {
        super(transform);

        this.inputHistory = [];
        this.velocity = 0.25;

        this.weapon = new PortalGun();
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
                this.fireAction(value, 0);
            } else if(key == INPUT_COMMAND.FIRE_2) {
                this.fireAction(value, 2);
            } else if(key == INPUT_COMMAND.WALL) {
                this.wallAction(value);
            }
        });
    }

    private moveDirectionAction(direction: string) {
        let newDirection: number = parseInt(direction);
        if(newDirection != this.moveDirection) {
            this.MoveDirection = parseInt(direction);
        }
    }

    private fireAction(angle: string, clickButton: number) {
        this.weapon.use(this, parseFloat(angle), clickButton);
    }

    private wallAction(coords) {
        this.invisible = !this.invisible;
        this.addChange("INV");
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

    public reconciliation(collisionsSystem: CollisionsSystem) {
        if(this.lastServerSnapshotData == null) {
            return;
        }
        let serverSnapshotId: number = this.lastServerSnapshotData[0];
        let serverSnapshotDelta: number = this.lastServerSnapshotData[1];
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
        this.lastServerSnapshotData = null;
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }

    get LastInputSnapshot(): InputSnapshot{
        return this.lastInputSnapshot;
    }

    set LastServerSnapshotData(lastSnapshotData: [number, number]){
        this.lastServerSnapshotData = lastSnapshotData;
    }
}

