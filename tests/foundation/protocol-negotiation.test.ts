import assert from "node:assert/strict";
import test from "node:test";

import { SocketMsgs } from "../../shared/net/SocketMsgs";
import {
    negotiateProtocolVersion,
    Protocol,
    protocolVersionFromInitializePayload,
    selectHighestCommonProtocolVersion,
} from "../../shared/net/Protocol";

test("foundation/protocol: socket message codes stay frozen on their v1 wire values", () => {
    const expectedCodes = [
        ["CHAT_MESSAGE", 0],
        ["CLIENT_READY", 1],
        ["HEARTBEAT", 2],
        ["INPUT_SNAPSHOT", 3],
        ["START_GAME", 4],
        ["INITIALIZE_GAME", 5],
        ["FIRST_UPDATE_GAME", 6],
        ["UPDATE_GAME", 7],
        ["HEARTBEAT_RESPONSE", 8],
        ["UPDATE_SNAPSHOT_DATA", 9],
        ["CHUNK_CHANGED", 10],
        ["ERROR", 11],
    ] as const;

    for (const [messageName, expectedCode] of expectedCodes) {
        assert.equal(SocketMsgs[messageName].charCodeAt(0), expectedCode, messageName);
    }

    assert.equal(SocketMsgs.CONNECTION, "connection");
    assert.equal(SocketMsgs.DISCONNECT, "disconnect");
    assert.equal(Object.isFrozen(SocketMsgs), true);
});

test("foundation/protocol: v2 is current and v1 remains the rolling-upgrade legacy", () => {
    assert.equal(Protocol.CURRENT, 2);
    assert.equal(Protocol.LEGACY, 1);
    assert.deepEqual(Protocol.SUPPORTED, [2, 1]);
    assert.equal(Object.isFrozen(Protocol), true);
    assert.equal(Object.isFrozen(Protocol.SUPPORTED), true);
});

test("foundation/protocol: negotiation selects the highest common version", () => {
    assert.equal(selectHighestCommonProtocolVersion([1, 3, 4], [1, 2, 3]), 3);
    assert.equal(selectHighestCommonProtocolVersion([3, 1, 3], [1, 2, 3]), 3);
    assert.equal(selectHighestCommonProtocolVersion([4], [1, 2, 3]), null);

    assert.deepEqual(negotiateProtocolVersion({ supportedProtocolVersions: [1] }), {
        ok: true,
        version: Protocol.LEGACY,
    });
    assert.deepEqual(negotiateProtocolVersion(undefined), { ok: true, version: Protocol.LEGACY });
});

test("foundation/protocol: malformed and unsupported offers are distinct controlled failures", () => {
    for (const malformedOffer of [
        null,
        {},
        "1",
        [1],
        { supportedProtocolVersions: [0] },
        { supportedProtocolVersions: [1.5] },
        { supportedProtocolVersions: [1, "2"] },
        { supportedProtocolVersions: Array(9).fill(1) },
    ]) {
        assert.deepEqual(negotiateProtocolVersion(malformedOffer), { ok: false, reason: "malformed" });
    }

    assert.deepEqual(negotiateProtocolVersion({ supportedProtocolVersions: [] }), { ok: false, reason: "unsupported" });
    assert.deepEqual(negotiateProtocolVersion({ supportedProtocolVersions: [3] }), {
        ok: false,
        reason: "unsupported",
    });
});

test("foundation/protocol: initialize without a version remains legacy v1", () => {
    assert.equal(protocolVersionFromInitializePayload({ id: "A0" }), Protocol.LEGACY);
    assert.equal(
        protocolVersionFromInitializePayload({ id: "A0", protocolVersion: Protocol.CURRENT }),
        Protocol.CURRENT,
    );
    assert.equal(protocolVersionFromInitializePayload({ id: "A0", protocolVersion: 3 }), null);
    assert.equal(protocolVersionFromInitializePayload(null), null);
});
