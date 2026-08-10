import assert from "node:assert/strict";
import {test} from "node:test";
import {Socket} from "socket.io";

import {ServerClient} from "../../server/ServerClient";
import {Protocol} from "../../shared/net/Protocol";

test("socket/server-client: rate limits are isolated and reset after their window", () => {
    const client = new ServerClient({} as Socket, "Guest test");

    assert.equal(client.allowEvent("chat", 2, 1000, 100), true);
    assert.equal(client.allowEvent("chat", 2, 1000, 200), true);
    assert.equal(client.allowEvent("chat", 2, 1000, 300), false);

    assert.equal(client.allowEvent("input", 1, 1000, 300), true);
    assert.equal(client.allowEvent("input", 1, 1000, 301), false);

    assert.equal(client.allowEvent("chat", 2, 1000, 1100), true);
    assert.equal(client.allowEvent("chat", 2, 1000, 50), true, "clock rollback resets the window");
});

test("socket/server-client: lifecycle state is explicit", () => {
    const socket = {} as Socket;
    const client = new ServerClient(socket, "user-1");

    assert.equal(client.Socket, socket);
    assert.equal(client.UserId, "user-1");
    assert.equal(client.IsReady, false);
    assert.equal(client.IsDisconnected, false);
    assert.equal(client.ProtocolVersion, null);

    client.IsReady = true;
    client.IsDisconnected = true;
    client.ProtocolVersion = Protocol.CURRENT;

    assert.equal(client.IsReady, true);
    assert.equal(client.IsDisconnected, true);
    assert.equal(client.ProtocolVersion, Protocol.CURRENT);
});
