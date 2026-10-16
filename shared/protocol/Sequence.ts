import { ProtocolError, ProtocolErrorCode } from "./ProtocolError";

export function isUint32(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

export function requireUint32(value: unknown, name: string, offset: number = 0): number {
    if (!isUint32(value)) {
        throw new ProtocolError(ProtocolErrorCode.INVALID_VALUE, offset, `${name} must be uint32`);
    }
    return value;
}

/** Serial-number arithmetic: callers must keep the live window below 2^31. */
export function isNewerSequence(candidate: number, previous: number): boolean {
    requireUint32(candidate, "candidate");
    requireUint32(previous, "previous");
    const distance = (candidate - previous) >>> 0;
    return distance !== 0 && distance < 0x80000000;
}

export function nextSequence(previous: number): number {
    return (requireUint32(previous, "previous") + 1) >>> 0;
}
