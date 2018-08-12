import {InputSnapshot} from "../common/input/InputSnapshot";
import {ChangesDict} from "../common/serialize/ChangesDict";
import {CollisionsSystem} from "../common/game_utils/physics/CollisionsSystem";
import {Player} from "../common/game_utils/game/objects/Player";

export class Reconciliation {
    private inputHistory: Array<InputSnapshot>;
    private lastServerSnapshotData: [number, number];
    private lastInputSnapshot: InputSnapshot;

    constructor() {
        this.inputHistory = [];
    }

    public pushSnapshotToHistory(inputSnapshot: InputSnapshot) {
        this.lastInputSnapshot = inputSnapshot;

        if(this.inputHistory.indexOf(inputSnapshot) == -1) {
            this.inputHistory.push(inputSnapshot);
        }
    }

    public reconciliation(player: Player, collisionsSystem: CollisionsSystem) {
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
            player.setInput(this.inputHistory[i]);

            let stepSize = 40;
            let steps: number = Math.floor(delta / stepSize);
            let rest: number = delta % stepSize;

            for (let i = 0; i <= steps; i++) {
                let step: number;
                if (i == steps) {
                    step = rest;
                } else {
                    step = stepSize;
                }

                let moveFactors: [number, number] = player.parseMoveDir();
                if (player.Transform.DeserializedFields.has(ChangesDict.X)) {
                    player.Transform.X += moveFactors[0] * player.Velocity * step;
                }
                if (player.Transform.DeserializedFields.has(ChangesDict.Y)) {
                    player.Transform.Y += moveFactors[1] * player.Velocity * step;
                }

                collisionsSystem.updateCollisionsForObject(player);
            }
        }
        this.inputHistory = this.inputHistory.splice(histElemsToRemove);
        this.lastServerSnapshotData = null;
    }

    set LastServerSnapshotData(lastSnapshotData: [number, number]){
        this.lastServerSnapshotData = lastSnapshotData;
    }
}