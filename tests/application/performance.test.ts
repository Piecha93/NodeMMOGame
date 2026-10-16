import assert from "node:assert/strict";
import test from "node:test";
import { io, Socket } from "socket.io-client";
import { createApplication } from "../../server/Application";
import { readApplicationConfig } from "../../server/ServerConfig";
import { GameCore } from "../../shared/GameCore";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { PerformanceEvents, PerformanceState } from "../../shared/gameplay/Performance";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";

const parser = require("socket.io-msgpack-parser");
const settings = (enabled = true) =>
    readApplicationConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        DEMO_SCENARIO: "none",
        SESSION_SECRET: "performance-test-session-secret-at-least-32-bytes",
        ENABLE_PERF_TESTS: String(enabled),
    });

function connect(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
    });
}
function nextState(socket: Socket, match: (state: PerformanceState) => boolean): Promise<PerformanceState> {
    return new Promise((resolve) => {
        const listener = (state: PerformanceState) => {
            if (match(state)) {
                socket.off(PerformanceEvents.STATE, listener);
                resolve(state);
            }
        };
        socket.on(PerformanceEvents.STATE, listener);
    });
}
function ready(socket: Socket): Promise<void> {
    return new Promise((resolve) => {
        socket.once(SocketMsgs.INITIALIZE_GAME, () => resolve());
        socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [2] });
    });
}

test("application/performance: authenticated namespace is isolated, logout revokes both worlds, restart owns resources", {
    timeout: 15_000,
}, async (t) => {
    const application = createApplication({ config: settings() });
    const sockets: Socket[] = [];
    t.after(async () => {
        for (const socket of sockets) socket.disconnect();
        await application.stop();
    });
    const { port } = await application.start();
    const base = `http://127.0.0.1:${port}`;
    const makeSocket = (namespace: string, cookie?: string) => {
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
    await assert.rejects(connect(makeSocket("/performance")), /authorized/);
    const login = await fetch(`${base}/login?mode=performance`, {
        method: "POST",
        redirect: "manual",
        body: new URLSearchParams({ username: "guest", password: "guest" }),
    });
    assert.equal(login.headers.get("location"), "/game?mode=performance");
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    const page = await fetch(`${base}/game?mode=performance`, { headers: { cookie } });
    const html = await page.text();
    assert.match(html, /id="performance-panel"/);
    assert.match(html, /name="count" type="number" min="0" max="20000" step="1"/);
    const ordinary = makeSocket("/", cookie);
    const performance = makeSocket("/performance", cookie);
    await Promise.all([connect(ordinary), connect(performance)]);
    await ready(ordinary);
    const initial = nextState(performance, () => true);
    // Configurations from admitted but not ready sockets cannot allocate entities.
    performance.emit(PerformanceEvents.CONFIGURE, { count: 2000, distribution: "world", scenario: "combat" });
    await ready(performance);
    assert.equal((await initial).count, 0);
    const populated = nextState(performance, (state) => state.count === 137 && state.pending === 0);
    performance.emit(PerformanceEvents.CONFIGURE, { count: 137, distribution: "world", scenario: "static" });
    assert.equal((await populated).enemies, 137);
    const normalCore = (application.gameServer as unknown as { core: GameCore }).core;
    const performanceServer = application.performanceServer;
    assert.ok(performanceServer);
    const performanceCore = (performanceServer as unknown as { core: GameCore }).core;
    assert.equal(
        [...normalCore.ObjectsManager.ObjectsById.values()].filter((object) => object instanceof Enemy).length,
        0,
    );
    assert.equal(
        [...performanceCore.ObjectsManager.ObjectsById.values()].filter((object) => object instanceof Enemy).length,
        137,
    );
    const normalDisconnected = new Promise<void>((resolve) => ordinary.once("disconnect", () => resolve()));
    const performanceDisconnected = new Promise<void>((resolve) => performance.once("disconnect", () => resolve()));
    const logout = await fetch(`${base}/logout`, { method: "POST", headers: { cookie }, redirect: "manual" });
    assert.equal(logout.status, 302);
    await Promise.all([normalDisconnected, performanceDisconnected]);
    assert.equal(
        [...performanceCore.ObjectsManager.ObjectsById.values()].filter((object) => object instanceof Enemy).length,
        0,
        "the last observer leaving cancels the performance workload",
    );
    await assert.rejects(connect(makeSocket("/performance", cookie)), /authorized|expired/);
    await application.stop();
    assert.equal(performanceCore.ObjectsManager.ObjectsById.size, 0);
    assert.equal(normalCore.ObjectsManager.ObjectsById.size, 0);
    assert.equal((performanceServer as unknown as { gameTimer: unknown }).gameTimer, null);
    assert.equal((performanceServer as unknown as { updateTimer: unknown }).updateTimer, null);
    await application.start();
    assert.notEqual(application.performanceServer, performanceServer);
    assert.equal(
        (application.performanceServer as unknown as { core: GameCore }).core.ObjectsManager.ObjectsById.size,
        0,
    );
});

test("application/performance: disabled mode has no namespace or entrypoint and production requires opt-in", {
    timeout: 10_000,
}, async (t) => {
    const production = {
        NODE_ENV: "production",
        SESSION_SECRET: "x".repeat(32),
        MONGODB_URI: "mongodb://localhost/game",
    };
    assert.equal(readApplicationConfig(production).enablePerformanceTests, false);
    assert.equal(readApplicationConfig({ ...production, ENABLE_PERF_TESTS: "true" }).enablePerformanceTests, true);
    assert.throws(() => readApplicationConfig({ ENABLE_PERF_TESTS: "yes" }), /ENABLE_PERF_TESTS/);
    const application = createApplication({ config: settings(false) });
    let socket: Socket | undefined;
    t.after(async () => {
        socket?.disconnect();
        await application.stop();
    });
    const { port } = await application.start();
    const base = `http://127.0.0.1:${port}`;
    assert.equal(application.performanceServer, null);
    assert.doesNotMatch(await (await fetch(base)).text(), /Poligon \/ test wydajności/);
    const login = await fetch(`${base}/login?mode=performance`, {
        method: "POST",
        redirect: "manual",
        body: new URLSearchParams({ username: "guest", password: "guest" }),
    });
    assert.equal(login.headers.get("location"), "/game");
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    assert.equal((await fetch(`${base}/game?mode=performance`, { headers: { cookie } })).status, 404);
    socket = io(`${base}/performance`, {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
        parser,
        extraHeaders: { Cookie: cookie },
    });
    await assert.rejects(connect(socket), /Invalid namespace/);
    await fetch(`${base}/logout`, { method: "POST", headers: { cookie }, redirect: "manual" });
    // Logout must not lazily create an unprotected namespace while tests are disabled.
    assert.equal(application.sockets._nsps.has("/performance"), false);
});
