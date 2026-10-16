import { InputSnapshot } from "../shared/input/InputSnapshot";
import { ChangesDict } from "../shared/serialize/ChangesDict";
import { CollisionsSystem } from "../shared/game_utils/physics/CollisionsSystem";
import { Player } from "../shared/game_utils/game/objects/Player";

export class Reconciliation {
    private inputHistory: Array<InputSnapshot>;
    private lastServerSnapshotData: [number, number] | null = null;

    private lastAcknowledgedInputId: number = -1;

    constructor() {
        this.inputHistory = [];
    }

    public pushSnapshotToHistory(inputSnapshot: InputSnapshot) {
        if (this.inputHistory.indexOf(inputSnapshot) == -1) {
            this.inputHistory.push(inputSnapshot);
        }
    }

    public reconciliation(player: Player, collisionsSystem: CollisionsSystem) {
        if (this.lastServerSnapshotData == null) {
            return;
        }

        let serverSnapshotId: number = this.lastServerSnapshotData[0];
        let serverSnapshotDelta: number = this.lastServerSnapshotData[1];
        let histElemsToRemove: number = 0;

        for (let i: number = 0; i < this.inputHistory.length; i++) {
            const current = this.inputHistory[i];
            if (!current) continue;
            if (current.ID < serverSnapshotId) {
                histElemsToRemove++;
                continue;
            }
            let delta: number = 0;

            if (i < this.inputHistory.length - 1) {
                delta = (this.inputHistory[i + 1]?.CreateTime ?? current.CreateTime) - current.CreateTime;
            } else {
                delta = current.SnapshotDelta;
            }
            if (current.ID == serverSnapshotId) {
                delta -= serverSnapshotDelta;
            }
            player.setInput(current);

            delta = Math.max(0, delta);
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

                player.updateColliders();
                collisionsSystem.update();
                collisionsSystem.updateCollisionsForGameObject(player);
                player.updateColliders();
                collisionsSystem.update();
            }
        }
        this.inputHistory = this.inputHistory.slice(histElemsToRemove);
        this.lastServerSnapshotData = null;
    }

    set LastServerSnapshotData(lastSnapshotData: [number, number]) {
        if (!lastSnapshotData || lastSnapshotData[0] < this.lastAcknowledgedInputId) {
            return;
        }
        this.lastAcknowledgedInputId = lastSnapshotData[0];
        // Idle acknowledgements can arrive without UPDATE_GAME. Retire older
        // commands now, retaining the acknowledged command for partial replay.
        this.inputHistory = this.inputHistory.filter((snapshot) => snapshot.ID >= lastSnapshotData[0]);
        this.lastServerSnapshotData = lastSnapshotData;
    }
}
