import type { PrefabName } from "./Types";

export type FieldType = "float64" | "uint16" | "bool" | "string";

export interface FieldSchema {
    readonly id: number;
    readonly name: string;
    readonly section: "transform" | "fields";
    readonly type: FieldType;
    readonly min?: number;
    readonly max?: number;
    readonly maxBytes?: number;
}

export interface EntitySchema {
    readonly prefab: PrefabName;
    readonly wireId: number;
    readonly idPrefix: string;
    readonly fields: readonly FieldSchema[];
}

export const V2_LIMITS = Object.freeze({
    MAX_FRAME_BYTES: 64 * 1024,
    MAX_RECORDS_PER_FRAME: 256,
    MAX_BATCHES: 256,
    MAX_SNAPSHOT_RECORDS: 65536,
    MAX_SNAPSHOT_BYTES: 8 * 1024 * 1024,
    MAX_STRING_BYTES: 4096,
    MAX_INPUT_ACTIONS: 8,
    MAX_COORDINATE: 1_000_000,
} as const);

function field(schema: FieldSchema): FieldSchema {
    return Object.freeze(schema);
}

// Explicit IDs belong to the versioned wire contract, independently of classes,
// decorators, property order, resource registration and object construction.
const transformFields = Object.freeze([
    field({ id: 1, name: "x", section: "transform", type: "float64", min: -1_000_000, max: 1_000_000 }),
    field({ id: 2, name: "y", section: "transform", type: "float64", min: -1_000_000, max: 1_000_000 }),
    field({ id: 3, name: "scaleX", section: "transform", type: "float64", min: 0, max: 1_000_000 }),
    field({ id: 4, name: "scaleY", section: "transform", type: "float64", min: 0, max: 1_000_000 }),
    field({ id: 5, name: "rotation", section: "transform", type: "float64" }),
]);

const baseFields = Object.freeze([
    ...transformFields,
    field({ id: 6, name: "velocity", section: "fields", type: "float64", min: 0, max: 10_000 }),
    field({ id: 7, name: "invisible", section: "fields", type: "bool" }),
    field({ id: 8, name: "spriteName", section: "fields", type: "string", maxBytes: 128 }),
]);

const actorFields = Object.freeze([
    ...baseFields,
    field({ id: 16, name: "name", section: "fields", type: "string", maxBytes: 256 }),
    field({ id: 17, name: "maxHp", section: "fields", type: "uint16" }),
    field({ id: 18, name: "hp", section: "fields", type: "uint16" }),
    field({ id: 19, name: "animationType", section: "fields", type: "string", maxBytes: 64 }),
    field({ id: 20, name: "horizontal", section: "fields", type: "float64", min: -1, max: 1 }),
    field({ id: 21, name: "vertical", section: "fields", type: "float64", min: -1, max: 1 }),
]);

function entitySchema(prefab: PrefabName, idPrefix: string, fields: readonly FieldSchema[]): EntitySchema {
    return Object.freeze({ prefab, idPrefix, wireId: idPrefix.charCodeAt(0), fields: Object.freeze([...fields]) });
}

export const ENTITY_SCHEMAS: Readonly<Record<PrefabName, EntitySchema>> = Object.freeze({
    DefaultPlayer: entitySchema("DefaultPlayer", "A", actorFields),
    Michau: entitySchema("Michau", "B", actorFields),
    Wall: entitySchema("Wall", "C", baseFields),
    HpPotion: entitySchema("HpPotion", "D", baseFields),
    Doors: entitySchema("Doors", "E", [
        ...baseFields,
        field({ id: 32, name: "isOpen", section: "fields", type: "bool" }),
    ]),
    FireBall: entitySchema("FireBall", "F", [
        ...baseFields,
        field({ id: 33, name: "power", section: "fields", type: "uint16" }),
        field({ id: 34, name: "owner", section: "fields", type: "string", maxBytes: 64 }),
    ]),
    Portal: entitySchema("Portal", "G", [
        ...baseFields,
        field({ id: 35, name: "isAttached", section: "fields", type: "bool" }),
    ]),
    PlatformTriggerTest: entitySchema("PlatformTriggerTest", "H", baseFields),
    ExpeditionMarker: entitySchema("ExpeditionMarker", "I", baseFields),
});

export const SCHEMAS_BY_WIRE_ID: Readonly<Record<number, EntitySchema>> = Object.freeze(
    Object.fromEntries(Object.values(ENTITY_SCHEMAS).map((schema) => [schema.wireId, schema])),
);

export const FIELD_TYPE_IDS: Readonly<Record<FieldType, number>> = Object.freeze({
    float64: 1,
    uint16: 2,
    bool: 3,
    string: 4,
});
