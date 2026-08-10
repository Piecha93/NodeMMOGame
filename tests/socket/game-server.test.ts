import assert from "node:assert/strict";
import {test} from "node:test";
import {Server, Socket} from "socket.io";

import {GameServer} from "../../server/GameServer";
import {ServerClient} from "../../server/ServerClient";
import {SocketMsgs} from "../../shared/net/SocketMsgs";
import {GameCore} from "../../shared/GameCore";

type SocketHandler = (...args: unknown[]) => void;

class FakeSocket {
    readonly request: {session: {user_id: string}};
    readonly handlers: Map<string, SocketHandler> = new Map();
    readonly emitted: Array<{event: string; args: unknown[]}> = [];
    connected: boolean = true;

    constructor(userId: string) {
        this.request = {session: {user_id: userId}};
    }

    compress(_compress: boolean) {
        return this;
    }

    on(event: string, handler: SocketHandler) {
        this.handlers.set(event, handler);
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        this.emitted.push({event, args});
        return this;
    }

    disconnect(_close?: boolean) {
        if (!this.connected) {
            return this;
        }

        this.connected = false;
        this.handlers.get(SocketMsgs.DISCONNECT)?.("server namespace disconnect");
        return this;
    }

    trigger(event: string, ...args: unknown[]) {
        const handler = this.handlers.get(event);
        assert.ok(handler, `missing handler for event ${JSON.stringify(event)}`);
        handler(...args);
    }

    emittedCount(event: string): number {
        return this.emitted.filter((message) => message.event === event).length;
    }
}

class FakeSocketServer {
    readonly emitted: Array<{event: string; args: unknown[]}> = [];

    on(_event: string, _handler: SocketHandler) {
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        this.emitted.push({event, args});
        return this;
    }
}

interface GameServerInternals {
    onConnection(socket: Socket): void;
    checkDisconnectInterval(): void;
    sanitizePlayerName(name: unknown): string;
    clients: Map<Socket, ServerClient>;
    userIdToSocketMap: Map<string, Socket>;
    lastChunkSent: Map<string, unknown>;
    lastDisconnectCheck: number;
    core: GameCore;
}

function createTestServer(): {server: GameServer; internals: GameServerInternals} {
    const server = new GameServer(new FakeSocketServer() as unknown as Server);
    return {server, internals: server as unknown as GameServerInternals};
}

function playerIdFrom(socket: FakeSocket): string {
    const initializeMessage = socket.emitted.find(({event}) => event === SocketMsgs.INITIALIZE_GAME);
    assert.ok(initializeMessage);
    return (initializeMessage.args[0] as {id: string}).id;
}

test("socket/game-server: ready is idempotent and malformed input stays inside the handler", () => {
    const {internals} = createTestServer();
    const socket = new FakeSocket("Guest ready-test");
    const objectsManager = internals.core.ObjectsManager;
    const initialObjectIds = new Set(objectsManager.ObjectsById.keys());

    internals.onConnection(socket as unknown as Socket);

    assert.doesNotThrow(() => socket.trigger(SocketMsgs.INPUT_SNAPSHOT, "malformed"));
    assert.doesNotThrow(() => socket.trigger(SocketMsgs.CHAT_MESSAGE, "spawner"));

    socket.trigger(SocketMsgs.CLIENT_READY);
    socket.trigger(SocketMsgs.CLIENT_READY);

    const playerId = playerIdFrom(socket);
    assert.equal(socket.emittedCount(SocketMsgs.INITIALIZE_GAME), 1);
    assert.equal(socket.emittedCount(SocketMsgs.FIRST_UPDATE_GAME), 1);
    assert.ok(objectsManager.get(playerId));
    assert.doesNotThrow(() => socket.trigger(SocketMsgs.INPUT_SNAPSHOT, "malformed"));

    socket.disconnect();
    assert.equal(objectsManager.get(playerId), undefined);
    assert.deepEqual(new Set(objectsManager.ObjectsById.keys()), initialObjectIds);
});

test("socket/game-server: a duplicate session closes and fully removes the old client", () => {
    const {internals} = createTestServer();
    const firstSocket = new FakeSocket("Guest duplicate-test");
    const secondSocket = new FakeSocket("Guest duplicate-test");
    const objectsManager = internals.core.ObjectsManager;

    internals.onConnection(firstSocket as unknown as Socket);
    firstSocket.trigger(SocketMsgs.CLIENT_READY);
    const oldPlayerId = playerIdFrom(firstSocket);
    internals.lastChunkSent.set(oldPlayerId, {});

    internals.onConnection(secondSocket as unknown as Socket);

    assert.equal(firstSocket.connected, false);
    assert.equal(objectsManager.get(oldPlayerId), undefined);
    assert.equal(internals.lastChunkSent.has(oldPlayerId), false);
    assert.equal(internals.clients.size, 1);
    assert.equal(internals.userIdToSocketMap.get("Guest duplicate-test"), secondSocket as unknown as Socket);

    secondSocket.disconnect();
    assert.equal(internals.clients.size, 0);
    assert.equal(internals.userIdToSocketMap.size, 0);
});

test("socket/game-server: timeout removes socket mappings, chunk state and player", () => {
    const {internals} = createTestServer();
    const socket = new FakeSocket("Guest timeout-test");
    const objectsManager = internals.core.ObjectsManager;

    internals.onConnection(socket as unknown as Socket);
    socket.trigger(SocketMsgs.CLIENT_READY);
    const playerId = playerIdFrom(socket);
    const client = internals.clients.get(socket as unknown as Socket);
    assert.ok(client);
    client.LastHbTime = 0;
    internals.lastChunkSent.set(playerId, {});
    internals.lastDisconnectCheck = 0;

    internals.checkDisconnectInterval();

    assert.equal(socket.connected, false);
    assert.equal(internals.clients.size, 0);
    assert.equal(internals.userIdToSocketMap.size, 0);
    assert.equal(internals.lastChunkSent.has(playerId), false);
    assert.equal(objectsManager.get(playerId), undefined);
});

test("socket/game-server: heartbeat and chat floods are capped per client", () => {
    const {internals, server} = createTestServer();
    const socket = new FakeSocket("Guest rate-test");
    const fakeServer = (server as unknown as {sockets: FakeSocketServer}).sockets;

    internals.onConnection(socket as unknown as Socket);
    for (let id = 0; id < 6; id++) {
        socket.trigger(SocketMsgs.HEARTBEAT, id);
        socket.trigger(SocketMsgs.CHAT_MESSAGE, `message ${id}`);
    }

    assert.equal(socket.emittedCount(SocketMsgs.HEARTBEAT_RESPONSE), 5);
    assert.equal(
        fakeServer.emitted.filter(({event, args}) =>
            event === SocketMsgs.CHAT_MESSAGE &&
            (args[0] as {s?: string}).s === "Guest rate-test"
        ).length,
        5,
    );

    socket.disconnect();
});

test("socket/game-server: database names are safe for the legacy HTML chat bundle", () => {
    const {internals} = createTestServer();
    const safeName = internals.sanitizePlayerName("  <img src=x onerror=alert(1)> Zażółć_User-12345678901234567890  ");

    assert.equal(safeName.length <= 32, true);
    assert.match(safeName, /^[\p{L}\p{N} _-]+$/u);
    assert.equal(safeName.includes("<"), false);
    assert.equal(internals.sanitizePlayerName("<>"), "User");
});
