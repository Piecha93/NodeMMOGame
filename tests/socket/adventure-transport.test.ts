import assert from "node:assert/strict";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test, TestContext } from "node:test";
import { io, Socket } from "socket.io-client";
import { createApplication } from "../../server/Application";
import { readApplicationConfig } from "../../server/ServerConfig";
import { GameCore } from "../../shared/GameCore";
import { AdventureEvents, AdventureState, isAdventureState } from "../../shared/gameplay/Adventure";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { SocketMsgs } from "../../shared/net/SocketMsgs";

const parser = require("socket.io-msgpack-parser");

function nextEvent<T>(socket: Socket, event: string, match: (value: T) => boolean = () => true): Promise<T> {
    return new Promise((resolve, reject) => {
        let lastValue: T | undefined;
        const listener = (value: T) => {
            lastValue = value;
            if (!match(value)) return;
            clearTimeout(timeout);
            socket.off(event, listener);
            resolve(value);
        };
        const timeout = setTimeout(() => {
            socket.off(event, listener);
            reject(new Error(`Timed out waiting for ${event}: ${JSON.stringify(lastValue)}`));
        }, 5000);
        socket.on(event, listener);
    });
}

function nextState(socket: Socket, match: (state: AdventureState) => boolean = () => true): Promise<AdventureState> {
    return nextEvent<unknown>(
        socket,
        AdventureEvents.STATE,
        (value) => isAdventureState(value) && match(value),
    ) as Promise<AdventureState>;
}

async function connect(socket: Socket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const connected = () => {
            socket.off("connect_error", failed);
            resolve();
        };
        const failed = (error: Error) => {
            socket.off("connect", connected);
            reject(error);
        };
        socket.once("connect", connected);
        socket.once("connect_error", failed);
        socket.connect();
    });
}

async function ready(socket: Socket): Promise<string> {
    const initialized = nextEvent<{ id: string; protocolVersion: number }>(socket, SocketMsgs.INITIALIZE_GAME);
    socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [3] });
    const value = await initialized;
    assert.equal(value.protocolVersion, 3);
    assert.equal(typeof value.id, "string");
    return value.id;
}

async function fixture(context: TestContext, performanceTests = false) {
    const application = createApplication({
        config: readApplicationConfig({
            NODE_ENV: "test",
            HOST: "127.0.0.1",
            PORT: "0",
            SESSION_STORE: "memory",
            DEMO_SCENARIO: "expedition",
            SESSION_SECRET: "adventure-transport-test-session-secret-32-bytes",
            ENABLE_PERF_TESTS: String(performanceTests),
        }),
        projectRoot: resolve(__dirname, "../../.."),
    });
    const sockets: Socket[] = [];
    const heartbeat = setInterval(() => {
        for (const socket of sockets) if (socket.connected) socket.emit(SocketMsgs.HEARTBEAT, Date.now());
    }, 2000);
    context.after(async () => {
        clearInterval(heartbeat);
        for (const socket of sockets) socket.disconnect();
        await application.stop();
    });
    const { port } = await application.start();
    const base = `http://127.0.0.1:${port}`;
    const makeSocket = (cookie?: string, namespace = "/") => {
        const socket = io(`${base}${namespace}`, {
            autoConnect: false,
            forceNew: true,
            reconnection: false,
            transports: ["websocket"],
            parser,
            ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
        });
        sockets.push(socket);
        return socket;
    };
    const login = async () => {
        const response = await fetch(`${base}/login`, {
            method: "POST",
            redirect: "manual",
            body: new URLSearchParams({ username: "guest", password: "guest" }),
        });
        assert.equal(response.status, 302);
        const cookie = response.headers.get("set-cookie")?.split(";")[0];
        assert.ok(cookie);
        return cookie;
    };
    return { application, base, makeSocket, login };
}

test("adventure transport: authenticated parties own their choices, performance stays isolated and logout removes progression", {
    timeout: 20_000,
}, async (context) => {
    const { application, base, makeSocket, login } = await fixture(context, true);
    await assert.rejects(connect(makeSocket()), /authorized/);
    const cookieA = await login();
    const cookieB = await login();
    const first = makeSocket(cookieA);
    const second = makeSocket(cookieB);
    await Promise.all([connect(first), connect(second)]);
    // A session without a ready player cannot create or customize progression.
    first.emit(AdventureEvents.UPGRADE, "power");
    first.emit(AdventureEvents.WEAPON, "lance");
    const firstState = nextState(first, (state) => state.players.length === 1);
    const idA = await ready(first);
    assert.equal((await firstState).players[0]?.id, idA);
    const party = nextState(first, (state) => state.players.length === 2);
    const idB = await ready(second);
    const admitted = await party;
    assert.deepEqual(new Set(admitted.players.map((player) => player.id)), new Set([idA, idB]));
    assert.ok(
        admitted.players.every((player) => player.level === 1 && player.points === 0 && player.weapon === "ember"),
    );
    for (const [event, value] of [
        [AdventureEvents.UPGRADE, "power"],
        [AdventureEvents.WEAPON, "lance"],
        [AdventureEvents.UPGRADE, { playerId: idB, upgrade: "power", points: 99 }],
        [AdventureEvents.WEAPON, { playerId: idB, weapon: "scatter", level: 20 }],
    ] as const) {
        const response = nextState(first);
        first.emit(event, value);
        assert.deepEqual((await response).players, admitted.players);
    }
    const performance = makeSocket(cookieA, "/performance");
    let performanceAdventureEvents = 0;
    performance.on(AdventureEvents.STATE, () => performanceAdventureEvents++);
    await connect(performance);
    await ready(performance);
    performance.emit(AdventureEvents.WEAPON, "lance");
    performance.emit(AdventureEvents.UPGRADE, "power");
    await delay(300);
    assert.equal(performanceAdventureEvents, 0, "the dedicated performance world has no adventure progression");
    const firstDisconnected = nextEvent(first, "disconnect");
    const performanceDisconnected = nextEvent(performance, "disconnect");
    const removed = nextState(second, (state) => state.players.length === 1 && state.players[0]?.id === idB);
    const logout = await fetch(`${base}/logout`, { method: "POST", headers: { cookie: cookieA }, redirect: "manual" });
    assert.equal(logout.status, 302);
    await Promise.all([firstDisconnected, performanceDisconnected, removed]);
    await assert.rejects(connect(makeSocket(cookieA)), /authorized|expired/);
    const late = makeSocket(await login());
    await connect(late);
    const fresh = nextState(late, (state) => state.players.length === 2);
    const lateId = await ready(late);
    const latePlayer = (await fresh).players.find((player) => player.id === lateId);
    assert.ok(latePlayer);
    assert.equal(latePlayer.level, 1);
    assert.equal(latePlayer.xp, 0);
    assert.equal(latePlayer.points, 0);
    assert.equal(application.gameServer.getDiagnostics().clients, 2);
});

test("adventure transport: collected kill loot levels the whole party and only acknowledged choices spend points", {
    timeout: 20_000,
}, async (context) => {
    const { application, makeSocket, login } = await fixture(context);
    const first = makeSocket(await login());
    const second = makeSocket(await login());
    await Promise.all([connect(first), connect(second)]);
    const idA = await ready(first);
    const joined = nextState(first, (state) => state.players.length === 2);
    const idB = await ready(second);
    await joined;
    const core = (application.gameServer as unknown as { core: GameCore }).core;
    const collector = core.ObjectsManager.get(idA);
    assert.ok(collector instanceof Player);
    // Ready admission precedes the first playable controller update. A real
    // input kill happens in a world tick; test-created kills obey that boundary.
    const activeBy = Date.now() + 5000;
    const admittedAtTick = core.Runtime.tick;
    while (
        (core.Runtime.tick === admittedAtTick ||
            !core.ChunksManager.getChunkAtPosition(collector.Transform.X, collector.Transform.Y)?.IsActive) &&
        Date.now() < activeBy
    )
        await delay(10);
    assert.equal(core.ChunksManager.getChunkAtPosition(collector.Transform.X, collector.Transform.Y)?.IsActive, true);
    const defeatAtCollector = () => {
        const enemy = core.ObjectsFactory.instantiateWithPosition("Michau", collector.Transform.Position);
        assert.ok(enemy instanceof Enemy);
        enemy.hit(1_000_000);
        enemy.destroy();
    };
    const firstDrop = nextState(first, (state) =>
        state.players.every((player) => player.xp === 10 && player.coins === 1),
    );
    defeatAtCollector();
    await firstDrop;
    const levelUpA = nextState(first, (state) =>
        state.players.every((player) => player.level === 2 && player.points === 1 && player.coins === 2),
    );
    const levelUpB = nextState(second, (state) =>
        state.players.every((player) => player.level === 2 && player.points === 1),
    );
    defeatAtCollector();
    await Promise.all([levelUpA, levelUpB]);
    const upgraded = nextState(
        first,
        (state) => state.players.find((player) => player.id === idA)?.upgrades.power === 1,
    );
    first.emit(AdventureEvents.UPGRADE, "power");
    first.emit(AdventureEvents.UPGRADE, "power");
    const afterUpgrade = await upgraded;
    assert.equal(afterUpgrade.players.find((player) => player.id === idA)?.points, 0);
    const other = afterUpgrade.players.find((player) => player.id === idB);
    assert.ok(other);
    assert.equal(other.points, 1);
    assert.equal(other.upgrades.power, 0, "the sender cannot spend another party member's point");
    const unchanged = nextState(first);
    first.emit(AdventureEvents.UPGRADE, { playerId: idB, upgrade: "vitality" });
    const afterDuplicate = await unchanged;
    assert.equal(afterDuplicate.players.find((player) => player.id === idA)?.upgrades.power, 1);
    assert.equal(afterDuplicate.players.find((player) => player.id === idB)?.upgrades.vitality, 0);
    const equipped = nextState(
        first,
        (state) => state.players.find((player) => player.id === idA)?.weapon === "scatter",
    );
    first.emit(AdventureEvents.WEAPON, "scatter");
    await equipped;
    const cycled = nextState(first, (state) => state.players.find((player) => player.id === idA)?.weapon === "ember");
    first.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: 1, horizontal: 0, vertical: 0, actions: [{ kind: "switchWeapon" }] });
    await cycled;
    const late = makeSocket(await login());
    await connect(late);
    const fresh = nextState(late, (state) => state.players.length === 3);
    const lateId = await ready(late);
    const freshState = await fresh;
    assert.equal(freshState.players.find((player) => player.id === idA)?.level, 2);
    assert.equal(freshState.players.find((player) => player.id === lateId)?.level, 1);
    assert.equal(freshState.players.find((player) => player.id === lateId)?.points, 0);
});
