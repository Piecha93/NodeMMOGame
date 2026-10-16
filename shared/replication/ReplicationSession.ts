import { GameCore } from "../GameCore";
import { Player } from "../game_utils/game/objects/Player";
import { EntityRecord, EntityState, FieldValue, Snapshot, TransformState, nextSequence } from "../protocol";
import { captureEntity } from "./EntityAdapter";

export class ReplicationSession {
    private baseline = new Map<string, EntityState>();
    private snapshotId = 0;

    prepare(core: GameCore, player: Player, ack: number | null): { snapshot: Snapshot; commit: () => void } {
        const chunk = core.ChunksManager.getObjectChunk(player);
        if (!chunk) throw new Error("Player has no interest area");
        const current = new Map<string, EntityState>();
        const records: EntityRecord[] = [];
        for (const visible of [chunk, ...chunk.Neighbors]) {
            for (const object of visible.Objects) {
                if (object.IsDestroyed) continue;
                const state = captureEntity(object);
                current.set(object.ID, state);
                const old = this.baseline.get(object.ID);
                if (!old) records.push({ kind: "create", state });
                else {
                    // Avoid building entries/filter/fromEntries arrays for every
                    // entity on every snapshot, including completely idle ones.
                    let fields: Record<string, FieldValue> | undefined;
                    for (const key in state.fields) {
                        const value = state.fields[key]!;
                        if (value !== old.fields[key]) (fields ??= {})[key] = value;
                    }
                    let transform: { -readonly [Key in keyof TransformState]?: number } | undefined;
                    for (const key of TRANSFORM_FIELDS) {
                        const value = state.transform[key];
                        if (value !== old.transform[key]) (transform ??= {})[key] = value;
                    }
                    if (fields || transform) {
                        records.push({ kind: "update", id: object.ID, prefab: state.prefab, fields, transform });
                    }
                }
            }
        }
        for (const id of this.baseline.keys()) if (!current.has(id)) records.push({ kind: "destroy", id });
        const snapshot: Snapshot = {
            serverTick: core.Runtime.tick,
            snapshotId: this.snapshotId,
            lastProcessedInputSeq: ack,
            localPlayerState: current.get(player.ID),
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

const TRANSFORM_FIELDS = ["x", "y", "scaleX", "scaleY", "rotation"] as const;
