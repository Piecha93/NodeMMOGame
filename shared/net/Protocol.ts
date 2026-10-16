export type ProtocolVersion = number;

export interface ClientProtocolOffer {
    supportedProtocolVersions: readonly ProtocolVersion[];
}

const supportedProtocolVersions = Object.freeze([3, 2, 1] as const);
const MAX_ADVERTISED_PROTOCOL_VERSIONS = 8;

export const Protocol = Object.freeze({
    LEGACY: 1 as ProtocolVersion,
    CURRENT: 3 as ProtocolVersion,
    SUPPORTED: supportedProtocolVersions as readonly ProtocolVersion[],
});

export function isSnapshotProtocol(version: ProtocolVersion | null): boolean {
    return version === 2 || version === 3;
}

export type ProtocolNegotiationResult =
    | { ok: true; version: ProtocolVersion }
    | { ok: false; reason: "malformed" | "unsupported" };

function isProtocolVersion(value: unknown): value is ProtocolVersion {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function selectHighestCommonProtocolVersion(
    clientVersions: readonly ProtocolVersion[],
    serverVersions: readonly ProtocolVersion[] = Protocol.SUPPORTED,
): ProtocolVersion | null {
    const supportedByServer = new Set(serverVersions);
    let selectedVersion: ProtocolVersion | null = null;

    for (const version of clientVersions) {
        if (supportedByServer.has(version) && (selectedVersion === null || version > selectedVersion)) {
            selectedVersion = version;
        }
    }

    return selectedVersion;
}

export function negotiateProtocolVersion(
    clientOfferPayload: unknown,
    serverVersions: readonly ProtocolVersion[] = Protocol.SUPPORTED,
): ProtocolNegotiationResult {
    let clientVersions: unknown;
    if (clientOfferPayload === undefined) {
        clientVersions = [Protocol.LEGACY];
    } else if (
        typeof clientOfferPayload === "object" &&
        clientOfferPayload !== null &&
        !Array.isArray(clientOfferPayload)
    ) {
        clientVersions = (clientOfferPayload as Record<string, unknown>).supportedProtocolVersions;
    } else {
        return { ok: false, reason: "malformed" };
    }

    if (
        !Array.isArray(clientVersions) ||
        clientVersions.length > MAX_ADVERTISED_PROTOCOL_VERSIONS ||
        !clientVersions.every(isProtocolVersion)
    ) {
        return { ok: false, reason: "malformed" };
    }

    const selectedVersion = selectHighestCommonProtocolVersion(clientVersions, serverVersions);
    if (selectedVersion === null) {
        return { ok: false, reason: "unsupported" };
    }

    return { ok: true, version: selectedVersion };
}

export function protocolVersionFromInitializePayload(payload: unknown): ProtocolVersion | null {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        return null;
    }

    const initializePayload = payload as Record<string, unknown>;
    const version = Object.prototype.hasOwnProperty.call(initializePayload, "protocolVersion")
        ? initializePayload.protocolVersion
        : Protocol.LEGACY;

    if (!isProtocolVersion(version) || !Protocol.SUPPORTED.includes(version)) {
        return null;
    }

    return version;
}
