export type PrefabName =
    | "DefaultPlayer"
    | "Michau"
    | "Wall"
    | "HpPotion"
    | "Doors"
    | "FireBall"
    | "Portal"
    | "PlatformTriggerTest"
    | "ExpeditionMarker";

export type FieldValue = number | string | boolean;
export type EntityFields = Readonly<Record<string, FieldValue>>;

export interface TransformState {
    readonly x: number;
    readonly y: number;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly rotation: number;
}

export interface EntityState {
    readonly id: string;
    readonly prefab: PrefabName;
    readonly transform: TransformState;
    readonly fields: EntityFields;
}

export type EntityRecord =
    | { readonly kind: "create"; readonly state: EntityState }
    | {
          readonly kind: "update";
          readonly id: string;
          readonly prefab: PrefabName;
          readonly transform?: Readonly<Partial<TransformState>>;
          readonly fields?: EntityFields;
      }
    | { readonly kind: "destroy"; readonly id: string };

export interface Snapshot {
    readonly serverTick: number;
    readonly snapshotId: number;
    readonly lastProcessedInputSeq: number | null;
    readonly localPlayerState?: EntityState;
    readonly records: readonly EntityRecord[];
}

export interface DecodedFrame extends Snapshot {
    readonly batchIndex: number;
    readonly batchCount: number;
}
