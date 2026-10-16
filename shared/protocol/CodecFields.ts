import { ProtocolError, ProtocolErrorCode } from "./ProtocolError";
import { ENTITY_SCHEMAS, SCHEMAS_BY_WIRE_ID, V2_LIMITS } from "./Schema";
import type { EntitySchema, FieldSchema } from "./Schema";
import { isEntityId } from "./EntityId";
import type { FieldValue, PrefabName } from "./Types";

const textEncoder = new TextEncoder();
const own = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

export interface SelectedField {
    readonly schema: FieldSchema;
    readonly value: FieldValue;
    readonly bytes: number;
    readonly utf8?: Uint8Array;
}

export function requireObject(value: unknown, name: string, offset: number = 0): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, offset, `${name} must be an object`);
    }
    return value as Record<string, unknown>;
}

export function schemaForPrefab(prefab: unknown, offset: number = 0): EntitySchema {
    if (typeof prefab !== "string" || !own(ENTITY_SCHEMAS, prefab)) {
        throw new ProtocolError(ProtocolErrorCode.UNKNOWN_PREFAB, offset);
    }
    return ENTITY_SCHEMAS[prefab as PrefabName];
}

export function entityId(
    id: unknown,
    schema?: EntitySchema,
    offset: number = 0,
): { schema: EntitySchema; sequence: number } {
    if (!isEntityId(id)) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_ID, offset);
    }
    const idSchema = SCHEMAS_BY_WIRE_ID[id.charCodeAt(0)];
    const sequence = Number(id.slice(1));
    if (!idSchema || sequence > 0xffffffff || (schema && idSchema !== schema)) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_ID, offset, "prefab and ID prefix must agree");
    }
    return { schema: idSchema, sequence };
}

export function validateField(schema: FieldSchema, value: unknown, offset: number = 0): FieldValue {
    if (schema.type === "string") {
        if (typeof value !== "string") {
            throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, offset, schema.name);
        }
        if (value.length > (schema.maxBytes ?? V2_LIMITS.MAX_STRING_BYTES)) {
            throw new ProtocolError(ProtocolErrorCode.STRING_LIMIT, offset, schema.name);
        }
        // TextEncoder replaces lone UTF-16 surrogates. Reject them to preserve a
        // lossless round trip rather than silently changing a caller's string.
        for (let index = 0; index < value.length; index++) {
            const unit = value.charCodeAt(index);
            if (unit >= 0xd800 && unit <= 0xdbff) {
                const low = value.charCodeAt(++index);
                if (!(low >= 0xdc00 && low <= 0xdfff)) {
                    throw new ProtocolError(ProtocolErrorCode.INVALID_UTF8, offset, "unpaired surrogate");
                }
            } else if (unit >= 0xdc00 && unit <= 0xdfff) {
                throw new ProtocolError(ProtocolErrorCode.INVALID_UTF8, offset, "unpaired surrogate");
            }
        }
        return value;
    }
    if (schema.type === "bool") {
        if (typeof value !== "boolean") {
            throw new ProtocolError(ProtocolErrorCode.FIELD_TYPE, offset, schema.name);
        }
        return value;
    }
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (schema.type === "uint16" && (!Number.isInteger(value) || value < 0 || value > 0xffff)) ||
        (schema.min !== undefined && value < schema.min) ||
        (schema.max !== undefined && value > schema.max)
    ) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, offset, schema.name);
    }
    return value;
}

export function selectFields(
    schema: EntitySchema,
    transform: unknown,
    fields: unknown,
    complete: boolean,
): SelectedField[] {
    const transformObject = transform === undefined ? {} : requireObject(transform, "transform");
    const fieldsObject = fields === undefined ? {} : requireObject(fields, "fields");
    for (const [section, values] of [
        ["transform", transformObject],
        ["fields", fieldsObject],
    ] as const) {
        for (const name of Object.keys(values)) {
            if (!schema.fields.some((field) => field.section === section && field.name === name)) {
                throw new ProtocolError(ProtocolErrorCode.UNKNOWN_FIELD, 0, `${schema.prefab}.${name}`);
            }
        }
    }

    const selected: SelectedField[] = [];
    for (const field of schema.fields) {
        const values = field.section === "transform" ? transformObject : fieldsObject;
        if (!own(values, field.name)) {
            if (complete) {
                throw new ProtocolError(ProtocolErrorCode.INCOMPLETE_CREATE, 0, field.name);
            }
            continue;
        }
        const value = validateField(field, values[field.name]);
        if (field.type === "string") {
            const utf8 = textEncoder.encode(value as string);
            if (utf8.byteLength > (field.maxBytes ?? V2_LIMITS.MAX_STRING_BYTES)) {
                throw new ProtocolError(ProtocolErrorCode.STRING_LIMIT, 0, field.name);
            }
            selected.push({ schema: field, value, utf8, bytes: utf8.byteLength });
        } else {
            selected.push({
                schema: field,
                value,
                bytes: field.type === "float64" ? 8 : field.type === "uint16" ? 2 : 1,
            });
        }
    }
    if (!complete && selected.length === 0) {
        throw new ProtocolError(ProtocolErrorCode.EMPTY_UPDATE);
    }
    return selected;
}
