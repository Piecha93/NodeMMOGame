import { GameCore } from "../GameCore";
import { GameObject } from "../game_utils/game/objects/GameObject";
import { ChangesDict } from "../serialize/ChangesDict";
import { ENTITY_SCHEMAS, EntityFields, EntityState, FieldValue, PrefabName, Snapshot } from "../protocol";

export function captureEntity(object: GameObject): EntityState {
    const prefab = object.ObjectsFactory.Catalog.IdToPrefabNames.get(object.ID.charAt(0)) as PrefabName | undefined;
    if (!prefab || !ENTITY_SCHEMAS[prefab]) throw new Error(`Missing v2 schema for '${object.ID}'`);
    const values = object as unknown as Record<string, FieldValue>;
    const fields: Record<string, FieldValue> = {};
    for (const field of ENTITY_SCHEMAS[prefab].fields) {
        if (field.section === "fields")
            fields[field.name] = field.type === "bool" ? Boolean(values[field.name]) : (values[field.name] ?? "");
    }
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
    applyFields(object, state.fields);
    const transform = object.Transform;
    transform.X = state.transform.x;
    transform.Y = state.transform.y;
    transform.ScaleX = state.transform.scaleX;
    transform.ScaleY = state.transform.scaleY;
    transform.Rotation = state.transform.rotation;
    transform.DeserializedFields.add(ChangesDict.X);
    transform.DeserializedFields.add(ChangesDict.Y);
    object.updateColliders();
}

function applyFields(object: GameObject, fields: EntityFields): void {
    // This adapter is the only bridge between versioned field names and domain
    // storage. The codec has already validated names and values against schema.
    for (const [name, value] of Object.entries(fields)) Reflect.set(object, name, value);
}

/** Validate runtime dependencies for the whole snapshot before world mutation. */
export function applySnapshot(core: GameCore, snapshot: Snapshot): void {
    const known = new Map(
        Array.from(
            core.ObjectsManager.ObjectsById,
            ([id, object]) => [id, core.ObjectsFactory.Catalog.IdToPrefabNames.get(object.ID.charAt(0))] as const,
        ),
    );
    for (const record of snapshot.records) {
        if (record.kind === "create") {
            if (known.has(record.state.id)) throw new Error(`Duplicate entity '${record.state.id}'`);
            known.set(record.state.id, record.state.prefab);
        } else if (record.kind === "update") {
            if (known.get(record.id) !== record.prefab) throw new Error(`Missing or mismatched entity '${record.id}'`);
        } else known.delete(record.id);
    }
    if (snapshot.localPlayerState && known.get(snapshot.localPlayerState.id) !== snapshot.localPlayerState.prefab) {
        throw new Error("Snapshot lacks its local player");
    }
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
            const previous = captureEntity(object);
            applyEntity(object, {
                ...previous,
                fields: { ...previous.fields, ...record.fields },
                transform: { ...previous.transform, ...record.transform },
            });
        }
    }
    if (snapshot.localPlayerState) {
        const local = core.ObjectsManager.get(snapshot.localPlayerState.id);
        if (local) applyEntity(local, snapshot.localPlayerState);
    }
    core.ChunksManager.rebuild();
    for (const object of core.ObjectsManager.ObjectsById.values()) object.updateColliders();
    core.CollisionsSystem.update();
}
