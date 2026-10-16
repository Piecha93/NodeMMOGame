import { GameCore } from "../GameCore";
import { GameObject } from "../game_utils/game/objects/GameObject";
import { ChangesDict } from "../serialize/ChangesDict";
import {
    ENTITY_SCHEMAS,
    EntityFields,
    EntityState,
    FieldValue,
    PrefabName,
    Snapshot,
    TransformState,
} from "../protocol";

const entityFields = Object.fromEntries(
    Object.entries(ENTITY_SCHEMAS).map(([prefab, schema]) => [
        prefab,
        schema.fields.filter((field) => field.section === "fields"),
    ]),
) as unknown as Record<PrefabName, (typeof ENTITY_SCHEMAS)[PrefabName]["fields"]>;

export function captureEntity(object: GameObject): EntityState {
    const prefab = object.ObjectsFactory.Catalog.IdToPrefabNames.get(object.ID.charAt(0)) as PrefabName | undefined;
    if (!prefab || !ENTITY_SCHEMAS[prefab]) throw new Error(`Missing v2 schema for '${object.ID}'`);
    const values = object as unknown as Record<string, FieldValue>;
    const fields: Record<string, FieldValue> = {};
    for (const field of entityFields[prefab])
        fields[field.name] = field.type === "bool" ? Boolean(values[field.name]) : (values[field.name] ?? "");
    const transform = object.Transform;
    return {
        id: object.ID,
        prefab,
        fields,
        transform: {
            x: transform.X,
            y: transform.Y,
            scaleX: transform.ScaleX,
            scaleY: transform.ScaleY,
            rotation: transform.Rotation,
        },
    };
}

export function applyEntity(object: GameObject, state: EntityState): void {
    applyPatch(object, state.fields, state.transform);
    object.updateColliders();
}

/** Apply only transmitted values; scalar updates do not touch spatial geometry. */
function applyPatch(object: GameObject, fields?: EntityFields, state?: Readonly<Partial<TransformState>>): boolean {
    if (fields) applyFields(object, fields);
    if (!state) return false;
    const transform = object.Transform;
    let changed = false;
    if (state.x !== undefined) {
        transform.DeserializedFields.add(ChangesDict.X);
        if (transform.X !== state.x) {
            transform.X = state.x;
            changed = true;
        }
    }
    if (state.y !== undefined) {
        transform.DeserializedFields.add(ChangesDict.Y);
        if (transform.Y !== state.y) {
            transform.Y = state.y;
            changed = true;
        }
    }
    if (state.scaleX !== undefined && transform.ScaleX !== state.scaleX) {
        transform.ScaleX = state.scaleX;
        changed = true;
    }
    if (state.scaleY !== undefined && transform.ScaleY !== state.scaleY) {
        transform.ScaleY = state.scaleY;
        changed = true;
    }
    if (state.rotation !== undefined && transform.Rotation !== state.rotation) {
        transform.Rotation = state.rotation;
        changed = true;
    }
    return changed;
}

function applyFields(object: GameObject, fields: EntityFields): void {
    // This adapter is the only bridge between versioned field names and domain
    // storage. The codec has already validated names and values against schema.
    const values = object as unknown as Record<string, FieldValue>;
    for (const name of Object.keys(fields)) {
        const value = fields[name]!;
        if (values[name] !== value) Reflect.set(object, name, value);
    }
}

/** Validate runtime dependencies for the whole snapshot before world mutation. */
export function applySnapshot(core: GameCore, snapshot: Snapshot): void {
    // The overlay models this batch's lifecycle without copying the entire world
    // for an otherwise empty or small delta. null is an explicit staged destroy.
    const known = new Map<string, string | null>();
    const knownPrefab = (id: string): string | null | undefined => {
        if (known.has(id)) return known.get(id);
        const object = core.ObjectsManager.get(id);
        return object ? core.ObjectsFactory.Catalog.IdToPrefabNames.get(object.ID.charAt(0)) : null;
    };
    for (const record of snapshot.records) {
        if (record.kind === "create") {
            if (knownPrefab(record.state.id) !== null) throw new Error(`Duplicate entity '${record.state.id}'`);
            known.set(record.state.id, record.state.prefab);
        } else if (record.kind === "update") {
            if (knownPrefab(record.id) !== record.prefab)
                throw new Error(`Missing or mismatched entity '${record.id}'`);
        } else known.set(record.id, null);
    }
    if (snapshot.localPlayerState && knownPrefab(snapshot.localPlayerState.id) !== snapshot.localPlayerState.prefab) {
        throw new Error("Snapshot lacks its local player");
    }
    const moved = new Set<GameObject>();
    for (const record of snapshot.records) {
        if (record.kind === "destroy") {
            core.ObjectsManager.destroy(record.id);
            continue;
        }
        if (record.kind === "create") {
            const state = record.state;
            core.ObjectsFactory.instantiateWithPosition(
                state.prefab,
                [state.transform.x, state.transform.y],
                [state.transform.scaleX, state.transform.scaleY],
                state.id,
                undefined,
                (object) => applyEntity(object, state),
            );
        } else {
            const object = core.ObjectsManager.get(record.id);
            if (!object) throw new Error(`Missing entity '${record.id}'`);
            if (applyPatch(object, record.fields, record.transform)) moved.add(object);
        }
    }
    if (snapshot.localPlayerState) {
        const local = core.ObjectsManager.get(snapshot.localPlayerState.id);
        if (local && applyPatch(local, snapshot.localPlayerState.fields, snapshot.localPlayerState.transform))
            moved.add(local);
    }
    for (const object of moved) {
        if (object.IsDestroyed) continue;
        core.ChunksManager.rebuildOne(object);
        if (!object.IsDestroyed) object.updateColliders();
    }
    if (moved.size > 0) core.CollisionsSystem.update();
}
