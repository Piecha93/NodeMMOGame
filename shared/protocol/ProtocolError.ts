export const ProtocolErrorCode = Object.freeze({
    INVALID_VALUE: "INVALID_VALUE",
    INVALID_ID: "INVALID_ID",
    UNKNOWN_PREFAB: "UNKNOWN_PREFAB",
    UNKNOWN_FIELD: "UNKNOWN_FIELD",
    FIELD_TYPE: "FIELD_TYPE",
    INCOMPLETE_CREATE: "INCOMPLETE_CREATE",
    EMPTY_UPDATE: "EMPTY_UPDATE",
    STRING_LIMIT: "STRING_LIMIT",
    INVALID_UTF8: "INVALID_UTF8",
    TRUNCATED: "TRUNCATED",
    BAD_MAGIC: "BAD_MAGIC",
    UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
    UNSUPPORTED_SCHEMA: "UNSUPPORTED_SCHEMA",
    INVALID_HEADER: "INVALID_HEADER",
    INVALID_RECORD: "INVALID_RECORD",
    DUPLICATE_FIELD: "DUPLICATE_FIELD",
    DUPLICATE_ENTITY: "DUPLICATE_ENTITY",
    FRAME_LIMIT: "FRAME_LIMIT",
    RECORD_LIMIT: "RECORD_LIMIT",
    BATCH_LIMIT: "BATCH_LIMIT",
    BATCH_MISMATCH: "BATCH_MISMATCH",
    INPUT_LIMIT: "INPUT_LIMIT",
} as const);

export type ProtocolErrorCode = (typeof ProtocolErrorCode)[keyof typeof ProtocolErrorCode];

export class ProtocolError extends Error {
    readonly code: ProtocolErrorCode;
    readonly offset: number;

    constructor(code: ProtocolErrorCode, offset: number = 0, detail?: string) {
        super(`${code} at byte ${offset}${detail === undefined ? "" : `: ${detail}`}`);
        this.name = "ProtocolError";
        this.code = code;
        this.offset = offset;
    }
}
