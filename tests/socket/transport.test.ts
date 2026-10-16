import assert from "node:assert/strict";
import { createServer, Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Server, Socket as ServerSocket } from "socket.io";
import { io, Socket as ClientSocket } from "socket.io-client";

import { normalizeBinaryPayload } from "../../client/net/BinaryPayload";
import { GameServer } from "../../server/GameServer";
import { ServerClient } from "../../server/ServerClient";
import { GameCore } from "../../shared/GameCore";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Protocol } from "../../shared/net/Protocol";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { Origin } from "../../shared/core/Origin";
import { decodeSnapshot } from "../../shared/protocol";
import { applySnapshot } from "../../shared/replication/EntityAdapter";

const parser = require("socket.io-msgpack-parser");

interface TransportServerInternals {
    core: GameCore;
    clients: Map<ServerSocket, ServerClient>;
    configureSockets(): void;
    collectAndSendUpdate(): void;
}

function listen(server: HttpServer): Promise<void> {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
}

function clientEvent<T>(socket: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve) => socket.once(event, resolve));
}

for (const transport of ["polling", "websocket"]) {
    test(`socket/transport: ${transport} negotiates v1, exchanges state and cleans up`, {
        timeout: 8000,
    }, async (t) => {
        const http = createServer();
        const sockets = new Server(http, { parser });
        // Supply an authenticated session at this boundary so the realtime
        // transport fixture needs neither MongoDB nor a DOM.
        sockets.use((socket, next) => {
            (socket.request as typeof socket.request & { session: { user_id: string } }).session = {
                user_id: `Guest transport-${transport}`,
            };
            next();
        });
        const gameServer = new GameServer(sockets);
        const game = gameServer as unknown as TransportServerInternals;
        game.configureSockets();
        let client: ClientSocket | undefined;

        t.after(async () => {
            client?.disconnect();
            gameServer.dispose();
            const closed = sockets.close();
            http.closeAllConnections();
            await closed;
        });

        await listen(http);
        const port = (http.address() as AddressInfo).port;
        const connected = new Promise<ServerSocket>((resolve) => sockets.once("connection", resolve));
        client = io(`http://127.0.0.1:${port}`, {
            autoConnect: false,
            reconnection: false,
            transports: [transport],
            parser,
        });
        const connect = new Promise<void>((resolve, reject) => {
            client.once("connect", resolve);
            client.once("connect_error", reject);
        });
        client.connect();
        await connect;
        const serverSocket = await connected;
        assert.equal(client.io.engine.transport.name, transport);

        const initialized = clientEvent<{ id: string; protocolVersion: number }>(client, SocketMsgs.INITIALIZE_GAME);
        const firstUpdate = clientEvent<unknown[]>(client, SocketMsgs.FIRST_UPDATE_GAME);
        client.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [Protocol.LEGACY] });
        const initialization = await initialized;
        assert.equal(initialization.protocolVersion, Protocol.LEGACY);
        const initialFrames = await firstUpdate;
        assert.equal(initialFrames.length, 1);
        const initialFrame = normalizeBinaryPayload(initialFrames[0]);
        assert.ok(initialFrame);
        assert.ok(initialFrame.byteLength > 5);

        const player = game.core.ObjectsManager.get(initialization.id) as Player;
        assert.ok(player);
        const oldX = player.Transform.X;
        const inputReceived = new Promise<void>((resolve) => serverSocket.once(SocketMsgs.INPUT_SNAPSHOT, resolve));
        client.emit(SocketMsgs.INPUT_SNAPSHOT, "1=2:0#5:1");
        await inputReceived;
        // Drive one real simulation step without starting unowned background loops.
        game.core.step(16);
        assert.equal(player.Transform.X, oldX + player.Velocity * 16);

        const acknowledged = clientEvent<[number, number]>(client, SocketMsgs.UPDATE_SNAPSHOT_DATA);
        const stateUpdate = clientEvent<unknown[]>(client, SocketMsgs.UPDATE_GAME);
        game.collectAndSendUpdate();
        const [sequence, elapsed] = await acknowledged;
        assert.equal(sequence, 1);
        assert.ok(Number.isFinite(elapsed) && elapsed >= 0);
        const frames = await stateUpdate;
        assert.ok(frames.length > 0);
        for (const frame of frames) {
            const normalizedFrame = normalizeBinaryPayload(frame);
            assert.ok(normalizedFrame);
            assert.ok(normalizedFrame.byteLength > 5);
        }

        const disconnected = new Promise<void>((resolve) => serverSocket.once("disconnect", () => resolve()));
        client.disconnect();
        await disconnected;
        assert.equal(game.clients.size, 0);
        assert.equal(game.core.ObjectsManager.get(initialization.id), undefined);
    });

    test(`socket/transport: ${transport} v2 tick acknowledgements and STOP coexist with a v1 observer`, {
        timeout: 12000,
    }, async (t) => {
        const http = createServer();
        const sockets = new Server(http, { parser });
        let identity = 0;
        sockets.use((socket, next) => {
            (socket.request as typeof socket.request & { session: { user_id: string } }).session = {
                user_id: `Guest mixed-${transport}-${identity++}`,
            };
            next();
        });
        const gameServer = new GameServer(sockets, { world: { fixedDeltaMs: 40, random: () => 0.1 } });
        const game = gameServer as unknown as TransportServerInternals;
        game.configureSockets();
        const replica = new GameCore({ role: Origin.CLIENT, fixedDeltaMs: 40 });
        const clients: ClientSocket[] = [];
        t.after(async () => {
            for (const client of clients) client.disconnect();
            gameServer.dispose();
            replica.dispose();
            const closed = sockets.close();
            http.closeAllConnections();
            await closed;
        });
        await listen(http);
        const port = (http.address() as AddressInfo).port;

        async function connect(version: 1 | 2) {
            const connected = new Promise<ServerSocket>((resolve) => sockets.once("connection", resolve));
            const socket = io(`http://127.0.0.1:${port}`, {
                autoConnect: false,
                reconnection: false,
                transports: [transport],
                parser,
            });
            clients.push(socket);
            const ready = new Promise<void>((resolve, reject) => {
                socket.once("connect", resolve);
                socket.once("connect_error", reject);
            });
            socket.connect();
            await ready;
            const serverSocket = await connected;
            const initialized = clientEvent<{ id: string; protocolVersion: number }>(
                socket,
                SocketMsgs.INITIALIZE_GAME,
            );
            const first = clientEvent<unknown>(socket, SocketMsgs.FIRST_UPDATE_GAME);
            socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [version] });
            const initialization = await initialized;
            assert.equal(initialization.protocolVersion, version);
            return { socket, serverSocket, initialization, first: await first };
        }
        function apply(payload: unknown) {
            assert.ok(Array.isArray(payload));
            const frames = payload.map(normalizeBinaryPayload);
            assert.ok(frames.every((frame) => frame !== null));
            const snapshot = decodeSnapshot(frames as ArrayBuffer[]);
            applySnapshot(replica, snapshot);
            return snapshot;
        }
        const modern = await connect(2);
        const initial = apply(modern.first);
        assert.equal(initial.lastProcessedInputSeq, null);
        const legacy = await connect(1);
        assert.equal(game.clients.size, 2);
        const player = game.core.ObjectsManager.get(modern.initialization.id);
        assert.ok(player instanceof Player);
        const startX = player.Transform.X;

        let received = new Promise<void>((resolve) => modern.serverSocket.once(SocketMsgs.INPUT_SNAPSHOT, resolve));
        modern.socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: 1, horizontal: 0, vertical: 1 });
        await received;
        let update = clientEvent<unknown>(modern.socket, SocketMsgs.UPDATE_GAME);
        game.collectAndSendUpdate();
        assert.equal(
            apply(await update).lastProcessedInputSeq,
            null,
            "accepting transport input is not simulation acknowledgement",
        );
        assert.equal(player.Transform.X, startX);

        game.core.step();
        update = clientEvent<unknown>(modern.socket, SocketMsgs.UPDATE_GAME);
        const legacyUpdate = clientEvent<unknown[]>(legacy.socket, SocketMsgs.UPDATE_GAME);
        game.collectAndSendUpdate();
        const moved = apply(await update);
        assert.equal(moved.lastProcessedInputSeq, 1);
        assert.equal(replica.ObjectsManager.get(player.ID)?.Transform.X, startX + 10);
        const legacyFrames = await legacyUpdate;
        assert.ok(legacyFrames.length > 0);
        assert.ok(legacyFrames.every((frame) => normalizeBinaryPayload(frame) !== null));

        received = new Promise<void>((resolve) => modern.serverSocket.once(SocketMsgs.INPUT_SNAPSHOT, resolve));
        modern.socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: 2, horizontal: 0, vertical: 0 });
        await received;
        game.core.step();
        update = clientEvent<unknown>(modern.socket, SocketMsgs.UPDATE_GAME);
        game.collectAndSendUpdate();
        assert.equal(apply(await update).lastProcessedInputSeq, 2);
        assert.equal(replica.ObjectsManager.get(player.ID)?.Transform.X, startX + 10);

        const modernClosed = new Promise<void>((resolve) => modern.serverSocket.once("disconnect", () => resolve()));
        modern.socket.disconnect();
        await modernClosed;
        assert.equal(game.clients.size, 1);
        assert.equal(game.core.ObjectsManager.get(player.ID), undefined);
        assert.ok(game.core.ObjectsManager.get(legacy.initialization.id));
        const legacyClosed = new Promise<void>((resolve) => legacy.serverSocket.once("disconnect", () => resolve()));
        legacy.socket.disconnect();
        await legacyClosed;
        assert.equal(game.clients.size, 0);
        assert.equal(game.core.ObjectsManager.ObjectsById.size, 0);
    });
}
