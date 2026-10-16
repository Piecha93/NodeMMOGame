import { GameCore } from "../GameCore";
import { Player } from "../game_utils/game/objects/Player";
import { EntityRecord, EntityState, FieldValue, Snapshot, TransformState, nextSequence } from "../protocol";
import { captureEntity } from "./EntityAdapter";

export interface ReplicationInterest {
    readonly halfWidth: number;
    readonly halfHeight: number;
    readonly hysteresis: number;
}

/** Includes camera look-ahead, interpolation and a prefetch margin around the 1024×576 viewport. */
export const VIEWPORT_INTEREST: Readonly<ReplicationInterest> = Object.freeze({
    halfWidth: 768,
    halfHeight: 512,
    hysteresis: 96,
});

export class ReplicationSession {
    private baseline = new Map<string, EntityState>();
    private snapshotId = 0;

    constructor(private readonly interest?: ReplicationInterest) {
        if (interest && Object.values(interest).some((value) => !Number.isFinite(value) || value < 0))
            throw new RangeError("Invalid replication interest bounds");
    }

    prepare(
        core: GameCore,
        player: Player,
        ack: number | null,
        captured?: Map<string, EntityState>,
    ): { snapshot: Snapshot; commit: () => void } {
        const chunk = core.ChunksManager.getObjectChunk(player);
        if (!chunk) throw new Error("Player has no interest area");
        const current = new Map<string, EntityState>();
        const records: EntityRecord[] = [];
        for (const visible of [chunk, ...chunk.Neighbors]) {
            for (const object of visible.Objects) {
                if (object.IsDestroyed) continue;
                if (this.interest && object !== player) {
                    const transform = object.Transform;
                    const margin = this.baseline.has(object.ID) ? this.interest.hysteresis : 0;
                    // A conservative radius also covers rotated scenery crossing an interest edge.
                    const radius = Math.hypot(transform.ScaleX, transform.ScaleY) / 2;
                    if (
                        Math.abs(transform.X - player.Transform.X) > this.interest.halfWidth + margin + radius ||
                        Math.abs(transform.Y - player.Transform.Y) > this.interest.halfHeight + margin + radius
                    )
                        continue;
                }
                const state = captured?.get(object.ID) ?? captureEntity(object);
                captured?.set(object.ID, state);
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
