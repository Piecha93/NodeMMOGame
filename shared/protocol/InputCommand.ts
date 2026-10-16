import { ProtocolError, ProtocolErrorCode } from "./ProtocolError";
import { V2_LIMITS } from "./Schema";
import { requireUint32 } from "./Sequence";
import { isEntityId } from "./EntityId";

export type InputDirection = -1 | 0 | 1;

export type InputAction =
    | { readonly kind: "primary" | "secondary" | "middle"; readonly x: number; readonly y: number }
    | { readonly kind: "interact"; readonly targetId: string }
    | { readonly kind: "switchWeapon" };

export interface InputCommand {
    readonly seq: number;
    readonly horizontal: InputDirection;
    readonly vertical: InputDirection;
    readonly actions?: readonly InputAction[];
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        Object.keys(value).some((key) => !keys.includes(key))
    ) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, 0, "malformed input object");
    }
    return value as Record<string, unknown>;
}

function direction(value: unknown): InputDirection {
    if (value !== -1 && value !== 0 && value !== 1) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, 0, "direction must be -1, 0 or 1");
    }
    return value;
}

function coordinate(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > V2_LIMITS.MAX_COORDINATE) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, 0, "invalid action coordinate");
    }
    return value;
}

function action(value: unknown): InputAction {
    const candidate = object(value, ["kind", "x", "y", "targetId"]);
    switch (candidate.kind) {
        case "primary":
        case "secondary":
        case "middle": {
            object(value, ["kind", "x", "y"]);
            return Object.freeze({ kind: candidate.kind, x: coordinate(candidate.x), y: coordinate(candidate.y) });
        }
        case "interact": {
            object(value, ["kind", "targetId"]);
            if (!isEntityId(candidate.targetId)) {
                throw new ProtocolError(ProtocolErrorCode.INVALID_ID, 0, "invalid interaction target");
            }
            return Object.freeze({ kind: "interact", targetId: candidate.targetId });
        }
        case "switchWeapon":
            object(value, ["kind"]);
            return Object.freeze({ kind: "switchWeapon" });
        default:
            throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, 0, "unknown input action");
    }
}

/** Validates and copies one command. Simulation duration is owned by the server. */
export function validateInputCommand(value: unknown): InputCommand {
    const candidate = object(value, ["seq", "horizontal", "vertical", "actions"]);
    const command = {
        seq: requireUint32(candidate.seq, "input sequence"),
        horizontal: direction(candidate.horizontal),
        vertical: direction(candidate.vertical),
    };
    if (candidate.actions === undefined) {
        return Object.freeze(command);
    }
    if (!Array.isArray(candidate.actions) || candidate.actions.length > V2_LIMITS.MAX_INPUT_ACTIONS) {
        throw new ProtocolError(ProtocolErrorCode.INPUT_LIMIT, 0, "invalid action count");
    }
    return Object.freeze({ ...command, actions: Object.freeze(Array.from(candidate.actions, action)) });
}
