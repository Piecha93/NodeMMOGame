import { GameCore } from "../GameCore";
import { Player } from "../game_utils/game/objects/Player";
import { EntityRecord, EntityState, Snapshot, nextSequence } from "../protocol";
import { captureEntity } from "./EntityAdapter";

export class ReplicationSession {
    private baseline = new Map<string, EntityState>();
    private snapshotId = 0;

    prepare(core: GameCore, player: Player, ack: number | null): { snapshot: Snapshot; commit: () => void } {
        const chunk = core.ChunksManager.getObjectChunk(player);
        if (!chunk) throw new Error("Player has no interest area");
        const current = new Map<string, EntityState>();
        for (const visible of [chunk, ...chunk.Neighbors]) {
            for (const object of visible.Objects)
                if (!object.IsDestroyed) current.set(object.ID, captureEntity(object));
        }
        const records: EntityRecord[] = [];
        for (const [id, state] of current) {
            const old = this.baseline.get(id);
            if (!old) records.push({ kind: "create", state });
            else {
                const fields = Object.fromEntries(
                    Object.entries(state.fields).filter(([key, value]) => value !== old.fields[key]),
                );
                const transform = Object.fromEntries(
                    Object.entries(state.transform).filter(
                        ([key, value]) => value !== old.transform[key as keyof typeof old.transform],
                    ),
                );
                if (Object.keys(fields).length || Object.keys(transform).length) {
                    records.push({ kind: "update", id, prefab: state.prefab, fields, transform });
                }
            }
        }
        for (const id of this.baseline.keys()) if (!current.has(id)) records.push({ kind: "destroy", id });
        const snapshot: Snapshot = {
            serverTick: core.Runtime.tick,
            snapshotId: this.snapshotId,
            lastProcessedInputSeq: ack,
            localPlayerState: captureEntity(player),
            records,
        };
        return {
            snapshot,
            commit: () => {
                this.baseline = current;
                this.snapshotId = nextSequence(this.snapshotId);
            },
        };
    }
}
