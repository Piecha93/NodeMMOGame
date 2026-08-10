export const ProtocolDecodeErrorCode = Object.freeze({
    EMPTY_UPDATE: "EMPTY_UPDATE",
    UPDATE_FRAME_LIMIT: "UPDATE_FRAME_LIMIT",
    RECORD_LIMIT: "RECORD_LIMIT",
    TRUNCATED_OBJECT_HEADER: "TRUNCATED_OBJECT_HEADER",
    TRUNCATED_OBJECT_PAYLOAD: "TRUNCATED_OBJECT_PAYLOAD",
    UNKNOWN_PROPERTY_MASK: "UNKNOWN_PROPERTY_MASK",
    INCOMPLETE_NEW_OBJECT: "INCOMPLETE_NEW_OBJECT",
    UNKNOWN_PREFAB: "UNKNOWN_PREFAB",
    PREFAB_MISMATCH: "PREFAB_MISMATCH",
    DUPLICATE_OBJECT_ID: "DUPLICATE_OBJECT_ID",
    TRUNCATED_TOMBSTONE_ID: "TRUNCATED_TOMBSTONE_ID",
    INVALID_TOMBSTONE_SECTION: "INVALID_TOMBSTONE_SECTION",
    DUPLICATE_TOMBSTONE_ID: "DUPLICATE_TOMBSTONE_ID",
    UPDATE_TOMBSTONE_CONFLICT: "UPDATE_TOMBSTONE_CONFLICT",
    INVALID_SCHEMA: "INVALID_SCHEMA",
} as const);

export type ProtocolDecodeErrorCode =
    typeof ProtocolDecodeErrorCode[keyof typeof ProtocolDecodeErrorCode];

export class ProtocolDecodeError extends Error {
    public readonly code: ProtocolDecodeErrorCode;
    public readonly offset: number;

    constructor(code: ProtocolDecodeErrorCode, offset: number, detail?: string) {
        super(detail ? `${code} at byte ${offset}: ${detail}` : `${code} at byte ${offset}`);
        this.name = "ProtocolDecodeError";
        this.code = code;
        this.offset = offset;
    }
}
