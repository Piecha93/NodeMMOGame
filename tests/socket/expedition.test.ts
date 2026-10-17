import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { once } from "node:events";
import test from "node:test";
import { Server, Socket as ServerSocket } from "socket.io";
import { io, Socket } from "socket.io-client";
import { GameServer } from "../../server/GameServer";
import { ExpeditionController } from "../../server/runtime/ExpeditionController";
import { AdventureController } from "../../server/runtime/AdventureController";
import { GameCore } from "../../shared/GameCore";
import {
    EXPEDITION,
    ExpeditionEvents,
    ExpeditionState,
    VILLAGE_PREPARATION_MS,
    isExpeditionState,
} from "../../shared/gameplay/Expedition";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Player } from "../../shared/game_utils/game/objects/Player";

const parser = require("socket.io-msgpack-parser");

function clientEvent<T>(socket: Socket, name: string): Promise<T> {
    return new Promise((resolve) => socket.once(name, resolve));
}

function matchingState(socket: Socket, predicate: (state: ExpeditionState) => boolean): Promise<ExpeditionState> {
    return new Promise((resolve) => {
        const receive = (state: unknown) => {
            if (!isExpeditionState(state) || !predicate(state)) return;
            socket.off(ExpeditionEvents.STATE, receive);
            resolve(state);
        };
        socket.on(ExpeditionEvents.STATE, receive);
    });
}

test("expedition transport: two real clients share finite wave progress, timeout and an authorized new round", {
    timeout: 8000,
}, async (t) => {
    const http = createServer();
    const sockets = new Server(http, { parser });
    sockets.use((socket, next) => {
        (socket.request as typeof socket.request & { session: { user_id: string } }).session = {
            user_id: `Guest ${socket.id}`,
        };
        next();
    });
    const server = new GameServer(sockets, { expedition: true });
    const game = server as unknown as {
        core: GameCore;
        expedition: ExpeditionController;
        adventure: AdventureController;
        configureSockets(): void;
        collectAndSendUpdate(): void;
    };
    game.expedition.start();
    game.configureSockets();
    const clients: Socket[] = [];
    t.after(async () => {
        for (const client of clients) client.disconnect();
        server.dispose();
        await sockets.close();
        http.closeAllConnections();
    });
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    async function connect(version = 2) {
        const socket = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"], parser });
        clients.push(socket);
        socket.connect();
        await clientEvent<void>(socket, "connect");
        const state = matchingState(socket, (value) => value.party.length > 0);
        if (version === 2) {
            const initialized = clientEvent<{ id: string }>(socket, SocketMsgs.INITIALIZE_GAME);
            socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [version] });
            const initial = await initialized;
            await state;
            return { socket, id: initial.id };
        }
        throw new Error("Unsupported test version");
    }
    const first = await connect();
    const both = matchingState(first.socket, (value) => value.party.length === 2);
    const second = await connect();
    const joined = await both;
    assert.equal(joined.phase, "active");
    assert.equal(joined.collected, 0);
    const player = game.core.ObjectsManager.get(first.id) as Player;
    const teammate = game.core.ObjectsManager.get(second.id) as Player;
    assert.ok(player instanceof Player && teammate instanceof Player);
    assert.ok(player.Transform.distanceTo(teammate.Transform) < 200, "party spawns together around the camp portal");

    game.adventure.update(VILLAGE_PREPARATION_MS);
    const enemies = [...game.core.ObjectsManager.objectsOfType(Enemy)];
    assert.equal(enemies.length, 4);
    for (const enemy of enemies) enemy.hit(enemy.MaxHP);
    game.core.step();
    const firstProgress = matchingState(first.socket, (value) => value.collected === 1 && value.waveStage === "rest");
    const secondProgress = matchingState(second.socket, (value) => value.collected === 1 && value.waveStage === "rest");
    game.core.advance(125);
    game.core.Runtime.timeMs += 200;
    game.collectAndSendUpdate();
    const [one, two] = await Promise.all([firstProgress, secondProgress]);
    assert.deepEqual(one, two);
    assert.equal(one.total, 6);
    assert.equal(one.kills, 4);
    assert.equal(one.enemiesRemaining, 0);
    assert.deepEqual(one.camps, []);

    // Directly advancing the controller avoids an eight-minute wall-clock test.
    game.expedition.update(EXPEDITION.durationMs);
    const lostFirst = matchingState(first.socket, (value) => value.phase === "lost");
    const lostSecond = matchingState(second.socket, (value) => value.phase === "lost");
    game.core.Runtime.timeMs += 200;
    game.collectAndSendUpdate();
    await Promise.all([lostFirst, lostSecond]);
    const roundFirst = matchingState(first.socket, (value) => value.round === 2);
    const roundSecond = matchingState(second.socket, (value) => value.round === 2);
    first.socket.emit(ExpeditionEvents.RESTART);
    const restarted = await Promise.all([roundFirst, roundSecond]);
    assert.equal(restarted[0].collected, 0);
    assert.equal(restarted[0].waveStage, "preparing");
    assert.equal(restarted[0].wave, 0);
    assert.equal(restarted[0].phase, "active");
    assert.deepEqual(restarted[0], restarted[1]);
    assert.equal(game.core.ObjectsManager.get(first.id), player, "restart preserves connected player identity");
    assert.equal(player.HP, player.MaxHP);
    assert.ok(Math.hypot(player.Transform.X - EXPEDITION.home.x, player.Transform.Y - EXPEDITION.home.y) < 100);

    const unauthorized = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"], parser });
    clients.push(unauthorized);
    unauthorized.connect();
    await clientEvent<void>(unauthorized, "connect");
    const rejection = clientEvent<string>(unauthorized, SocketMsgs.ERROR);
    unauthorized.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [1] });
    const reason = await rejection;
    assert.match(String(reason), /aktualnego klienta/);

    await connect();
    await connect();
    assert.equal(game.expedition.state().party.length, 4);
    const overflow = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"], parser });
    clients.push(overflow);
    overflow.connect();
    await clientEvent<void>(overflow, "connect");
    const full = clientEvent<string>(overflow, SocketMsgs.ERROR);
    overflow.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [2] });
    assert.match(await full, /pełna/);
    assert.equal(game.expedition.state().party.length, 4);
});
