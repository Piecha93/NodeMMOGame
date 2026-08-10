/**
 * MessagePack represents an ArrayBuffer differently between its Node and
 * browser decoders. Normalize both representations before passing bytes to
 * the game protocol decoder.
 */
export function normalizeBinaryPayload(payload: unknown): ArrayBuffer | null {
    if (payload instanceof ArrayBuffer) {
        return payload;
    }

    if (ArrayBuffer.isView(payload)) {
        const bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        return copy.buffer;
    }

    // notepack.io's browser decoder exposes MessagePack extension values as
    // [extensionType, bytes]. Extension type 0 is its ArrayBuffer encoding.
    if (Array.isArray(payload) && payload.length === 2 && payload[0] === 0) {
        return normalizeBinaryPayload(payload[1]);
    }

    return null;
}
