import assert from "node:assert/strict";
import { test } from "node:test";
import { Server, Socket } from "socket.io";

import { GameServer } from "../../server/GameServer";
import { ServerClient } from "../../server/ServerClient";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { GameCore } from "../../shared/GameCore";
import { Protocol } from "../../shared/net/Protocol";
import { Socket as ClientSocket } from "socket.io-client";
import { InputSender } from "../../client/net/InputSender";
import { InputSnapshot } from "../../shared/input/InputSnapshot";
import { ClientsInputSnapshotHandler } from "../../server/ClientsInputSnapshotHandler";
import { Chunk } from "../../shared/chunks/Chunk";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { ObjectsSerializer } from "../../shared/serialize/ObjectsSerializer";
import { captureEntity } from "../../shared/replication/EntityAdapter";
import { encodeSnapshot } from "../../shared/protocol";

type SocketHandler = (...args: unknown[]) => void;

class FakeSocket {
    readonly request: { session: { user_id: string } };
    readonly handlers: Map<string, SocketHandler> = new Map();
    readonly emitted: Array<{ event: string; args: unknown[] }> = [];
    connected: boolean = true;

    constructor(userId: string) {
        this.request = { session: { user_id: userId } };
    }

    compress(_compress: boolean) {
        return this;
    }

    on(event: string, handler: SocketHandler) {
        this.handlers.set(event, handler);
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        this.emitted.push({ event, args });
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
    readonly emitted: Array<{ event: string; args: unknown[] }> = [];

    on(_event: string, _handler: SocketHandler) {
        return this;
    }

    off(_event: string, _handler: SocketHandler) {
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        this.emitted.push({ event, args });
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
    clientsInputSnapshotHandler: ClientsInputSnapshotHandler;
    sendUpdate(chunksUpdate: Map<Chunk, ArrayBuffer>): void;
    sendV2Snapshot(client: ServerClient, first?: boolean): void;
}

function createTestServer(): { server: GameServer; internals: GameServerInternals } {
    const server = new GameServer(new FakeSocketServer() as unknown as Server);
    return { server, internals: server as unknown as GameServerInternals };
}

function initializePayloadFrom(socket: FakeSocket): { id: string; protocolVersion?: number } {
    const initializeMessage = socket.emitted.find(({ event }) => event === SocketMsgs.INITIALIZE_GAME);
    assert.ok(initializeMessage);
    return initializeMessage.args[0] as { id: string; protocolVersion?: number };
}

function playerIdFrom(socket: FakeSocket): string {
    return initializePayloadFrom(socket).id;
}

test("socket/game-server: ready is idempotent and malformed input stays inside the handler", () => {
    const { internals } = createTestServer();
    const socket = new FakeSocket("Guest ready-test");
    const objectsManager = internals.core.ObjectsManager;
    const initialObjectIds = new Set(objectsManager.ObjectsById.keys());

    internals.onConnection(socket as unknown as Socket);

    assert.doesNotThrow(() => socket.trigger(SocketMsgs.INPUT_SNAPSHOT, "malformed"));
    assert.doesNotThrow(() => socket.trigger(SocketMsgs.CHAT_MESSAGE, "spawner"));

    const protocolOffer = { supportedProtocolVersions: [...Protocol.SUPPORTED] };
    socket.trigger(SocketMsgs.CLIENT_READY, protocolOffer);
    socket.trigger(SocketMsgs.CLIENT_READY, protocolOffer);

    const initializePayload = initializePayloadFrom(socket);
    const playerId = initializePayload.id;
    const client = internals.clients.get(socket as unknown as Socket);
    assert.ok(client);
    assert.equal(socket.emittedCount(SocketMsgs.INITIALIZE_GAME), 1);
    assert.equal(socket.emittedCount(SocketMsgs.FIRST_UPDATE_GAME), 1);
    assert.equal(initializePayload.protocolVersion, Protocol.CURRENT);
    assert.equal(client.ProtocolVersion, Protocol.CURRENT);
    assert.ok(objectsManager.get(playerId));
    assert.doesNotThrow(() => socket.trigger(SocketMsgs.INPUT_SNAPSHOT, "malformed"));

    socket.disconnect();
    assert.equal(client.ProtocolVersion, null);
    assert.equal(objectsManager.get(playerId), undefined);
    assert.deepEqual(new Set(objectsManager.ObjectsById.keys()), initialObjectIds);
});

test("socket/game-server: a ready event without a payload negotiates legacy v1", () => {
    const { internals } = createTestServer();
    const socket = new FakeSocket("Guest legacy-protocol-test");

    internals.onConnection(socket as unknown as Socket);
    socket.trigger(SocketMsgs.CLIENT_READY);

    const client = internals.clients.get(socket as unknown as Socket);
    assert.ok(client);
    assert.equal(client.ProtocolVersion, Protocol.LEGACY);
    assert.equal(initializePayloadFrom(socket).protocolVersion, Protocol.LEGACY);

    socket.disconnect();
});

test("socket/game-server: malformed and unsupported protocol offers disconnect without a player", () => {
    const rejectedOffers: Array<{ payload: unknown; error: RegExp }> = [
        { payload: null, error: /Malformed protocol negotiation/ },
        { payload: { supportedProtocolVersions: [1, "2"] }, error: /Malformed protocol negotiation/ },
        { payload: { supportedProtocolVersions: [3] }, error: /Unsupported protocol version/ },
    ];

    for (const [index, rejectedOffer] of rejectedOffers.entries()) {
        const { internals } = createTestServer();
        const socket = new FakeSocket(`Guest rejected-protocol-${index}`);
        const initialObjectIds = new Set(internals.core.ObjectsManager.ObjectsById.keys());

        internals.onConnection(socket as unknown as Socket);
        socket.trigger(SocketMsgs.CLIENT_READY, rejectedOffer.payload);

        const errorMessage = socket.emitted.find(({ event }) => event === SocketMsgs.ERROR);
        assert.ok(errorMessage);
        assert.match(errorMessage.args[0] as string, rejectedOffer.error);
        assert.equal(socket.connected, false);
        assert.equal(socket.emittedCount(SocketMsgs.INITIALIZE_GAME), 0);
        assert.equal(socket.emittedCount(SocketMsgs.FIRST_UPDATE_GAME), 0);
        assert.equal(internals.clients.size, 0);
        assert.equal(internals.userIdToSocketMap.size, 0);
        assert.deepEqual(new Set(internals.core.ObjectsManager.ObjectsById.keys()), initialObjectIds);
    }
});

test("socket/game-server: a duplicate session closes and fully removes the old client", () => {
    const { internals } = createTestServer();
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
    const { internals } = createTestServer();
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
    const { internals, server } = createTestServer();
    const socket = new FakeSocket("Guest rate-test");
    const fakeServer = (server as unknown as { sockets: FakeSocketServer }).sockets;

    internals.onConnection(socket as unknown as Socket);
    for (let id = 0; id < 6; id++) {
        socket.trigger(SocketMsgs.HEARTBEAT, id);
        socket.trigger(SocketMsgs.CHAT_MESSAGE, `message ${id}`);
    }

    assert.equal(socket.emittedCount(SocketMsgs.HEARTBEAT_RESPONSE), 5);
    assert.equal(
        fakeServer.emitted.filter(
            ({ event, args }) =>
                event === SocketMsgs.CHAT_MESSAGE && (args[0] as { s?: string }).s === "Guest rate-test",
        ).length,
        5,
    );

    socket.disconnect();
});

test("socket/game-server: database names are safe for the legacy HTML chat bundle", () => {
    const { internals } = createTestServer();
    const safeName = internals.sanitizePlayerName("  <img src=x onerror=alert(1)> Zażółć_User-12345678901234567890  ");

    assert.equal(safeName.length <= 32, true);
    assert.match(safeName, /^[\p{L}\p{N} _-]+$/u);
    assert.equal(safeName.includes("<"), false);
    assert.equal(internals.sanitizePlayerName("<>"), "User");
});

test("socket/game-server: name limits preserve complete astral Unicode letters for v2", () => {
    const { server, internals } = createTestServer();
    try {
        const expected = `${"a".repeat(31)}𐐀`;
        const safeName = internals.sanitizePlayerName(`\u0000 \u001B${expected}b`);
        assert.equal(safeName, expected);
        assert.equal(Array.from(safeName).length, 32);
        const player = internals.core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        player.Name = safeName;
        assert.doesNotThrow(() =>
            encodeSnapshot({
                serverTick: 0,
                snapshotId: 0,
                lastProcessedInputSeq: null,
                localPlayerState: captureEntity(player),
                records: [{ kind: "create", state: captureEntity(player) }],
            }),
        );
    } finally {
        server.dispose();
    }
});

test("socket/game-server: initial codec failures disconnect and clean up inside readiness", async (t) => {
    for (const version of [1, 2]) {
        await t.test(`v${version}`, (context) => {
            const { server, internals } = createTestServer();
            const socket = new FakeSocket(`Guest codec-failure-${version}`);
            const log = context.mock.method(console, "error", () => {});
            if (version === 1) {
                context.mock.method(ObjectsSerializer, "serializeObject", () => {
                    throw new Error("injected initial codec failure");
                });
            } else {
                context.mock.method(internals, "sendV2Snapshot", () => {
                    throw new Error("injected initial codec failure");
                });
            }
            try {
                internals.onConnection(socket as unknown as Socket);
                assert.doesNotThrow(() =>
                    socket.trigger(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [version] }),
                );
                assert.equal(socket.connected, false);
                assert.equal(internals.clients.size, 0);
                assert.equal(internals.userIdToSocketMap.size, 0);
                assert.equal(internals.core.ObjectsManager.ObjectsById.size, 0);
                assert.equal(log.mock.callCount(), 1);
            } finally {
                server.dispose();
            }
        });
    }
});

test("socket/game-server: movement retry recovers a rate-limited STOP and idle input is acknowledged", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
    const { internals } = createTestServer();
    const socket = new FakeSocket("Guest stop-retry");
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const clientSocket = {
        connected: true,
        on(event: string, handler: (...args: unknown[]) => void) {
            handlers.set(event, handler);
            return this;
        },
        emit(event: string, payload: unknown) {
            socket.trigger(event, payload);
            return this;
        },
    };
    const sender = new InputSender(clientSocket as unknown as ClientSocket);

    try {
        internals.onConnection(socket as unknown as Socket);
        socket.trigger(SocketMsgs.CLIENT_READY);
        const player = internals.core.ObjectsManager.get(playerIdFrom(socket)) as Player;
        for (let seq = 1; seq <= 30; seq++) {
            sender.sendInput(new InputSnapshot(`${seq}=2:0#5:1`));
        }
        sender.sendInput(new InputSnapshot("31=2:0#5:0"));
        const rateLimitedSnapshot = internals.clientsInputSnapshotHandler.getPlayerLastSnapshot(player);
        assert.ok(rateLimitedSnapshot);
        assert.equal(rateLimitedSnapshot.ID, 30, "the normal server rate limit must still reject the excess input");
        assert.equal(player.Vertical, 1);

        t.mock.timers.tick(1000);
        const retriedSnapshot = internals.clientsInputSnapshotHandler.getPlayerLastSnapshot(player);
        assert.ok(retriedSnapshot);
        assert.equal(retriedSnapshot.ID, 31);
        assert.equal(player.Vertical, 0, "the retry must recover STOP after the rate limit resets");
        const x = player.Transform.X;
        player.update(40);
        assert.equal(player.Transform.X, x);

        internals.sendUpdate(new Map());
        const ack = socket.emitted.filter(({ event }) => event === SocketMsgs.UPDATE_SNAPSHOT_DATA).at(-1);
        assert.ok(ack, "idle input needs an ACK even when there is no world delta");
        assert.equal((ack.args[0] as [number, number])[0], 31);
        handlers.get(SocketMsgs.UPDATE_SNAPSHOT_DATA)?.(ack.args[0]);
    } finally {
        clientSocket.connected = false;
        handlers.get(SocketMsgs.DISCONNECT)?.();
        socket.disconnect();
        internals.core.dispose();
    }
});
