import { SCHEMAS_BY_WIRE_ID } from "./Schema";

/** The schema registry is the single source of supported prefab prefixes. */
export function isEntityId(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length >= 2 &&
        /^(0|[1-9]\d{0,9})$/.test(value.slice(1)) &&
        SCHEMAS_BY_WIRE_ID[value.charCodeAt(0)] !== undefined &&
        Number(value.slice(1)) <= 0xffffffff
    );
}
