import { ENTITY_SCHEMAS, EntityRecord, EntityState, FieldValue, PrefabName, Snapshot } from "../../shared/protocol";

export function entity(prefab: PrefabName = "Wall", sequence: number = 1): EntityState {
    const schema = ENTITY_SCHEMAS[prefab];
    const defaults: Record<string, FieldValue> = {
        velocity: 0,
        invisible: false,
        spriteName: "wall",
        name: "Zażółć gęślą jaźń 🎮",
        maxHp: 200,
        hp: 175,
        animationType: "idle",
        horizontal: 0,
        vertical: 0,
        isOpen: false,
        power: 25,
        owner: "A1",
        isAttached: false,
    };
    const fields: Record<string, FieldValue> = {};
    for (const field of schema.fields) {
        if (field.section === "fields") fields[field.name] = defaults[field.name] ?? 0;
    }
    return {
        id: schema.idPrefix + sequence,
        prefab,
        transform: { x: 100.25, y: 200.5, scaleX: 32, scaleY: 32, rotation: 0 },
        fields,
    };
}

export function snapshot(records: readonly EntityRecord[] = []): Snapshot {
    return { serverTick: 1, snapshotId: 2, lastProcessedInputSeq: null, records };
}
