import { CollisionsSystem } from "../../shared/game_utils/physics/CollisionsSystem";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { InputCommand, EntityState, isNewerSequence } from "../../shared/protocol";
import { commandToSnapshot } from "../../shared/replication/InputCommandAdapter";
import { simulateMovement } from "../../shared/core/SimulateMovement";
import { applyEntity } from "../../shared/replication/EntityAdapter";
import type { ChunksManager } from "../../shared/chunks/ChunksManager";

export class V2Prediction {
    private pending: InputCommand[] = [];
    constructor(private readonly fixedDeltaMs: number) {}

    predict(player: Player, command: InputCommand): void {
        if (this.pending.length >= 256) throw new Error("Prediction history exceeded; resynchronization required");
        this.pending.push(command);
        player.setInput(commandToSnapshot(command, false));
    }

    reconcile(
        player: Player,
        state: EntityState,
        ack: number | null,
        collisions: CollisionsSystem,
        chunks: Pick<ChunksManager, "rebuildOne">,
    ): void {
        applyEntity(player, state);
        chunks.rebuildOne(player);
        if (ack !== null) this.pending = this.pending.filter((command) => isNewerSequence(command.seq, ack));
        for (const command of this.pending) {
            player.setInput(commandToSnapshot(command, false));
            simulateMovement(player, collisions, this.fixedDeltaMs, () => chunks.rebuildOne(player));
        }
        player.updateColliders();
        collisions.update();
    }

    get PendingCount(): number {
        return this.pending.length;
    }
}
