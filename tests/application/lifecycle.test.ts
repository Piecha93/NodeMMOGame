import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { Server } from "socket.io";
import { createApplication } from "../../app";
import { GameServer } from "../../server/GameServer";
import { readApplicationConfig } from "../../server/ServerConfig";
import { disabledUserRepository } from "../../server/database/UserRepository";
import { GameCore } from "../../shared/GameCore";

interface GameServerState {
    gameTimer: ReturnType<typeof setTimeout> | null;
    updateTimer: ReturnType<typeof setTimeout> | null;
    core: GameCore;
}

const config = () =>
    readApplicationConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        DEMO_SCENARIO: "none",
        SESSION_SECRET: "application-lifecycle-test-secret-at-least-32-bytes",
    });

test("application/game-server: start and stop own timers, listeners, objects and restart", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
    const sockets = new EventEmitter();
    let seedCalls = 0;
    const game = new GameServer(sockets as unknown as Server, {
        seedWorld: (core) => {
            seedCalls++;
            core.ObjectsFactory.instantiateWithPosition("Wall", [100, 100]);
        },
    });
    const state = game as unknown as GameServerState;
    try {
        assert.equal(state.core.ObjectsManager.ObjectsById.size, 0, "constructor does not silently seed a demo");
        game.start();
        game.start();
        assert.equal(seedCalls, 1);
        assert.equal(sockets.listenerCount("connection"), 1);
        assert.notEqual(state.gameTimer, null);
        assert.notEqual(state.updateTimer, null);

        const firstCore = state.core;
        game.stop();
        game.stop();
        assert.equal(firstCore.ObjectsManager.ObjectsById.size, 0);
        assert.equal(sockets.listenerCount("connection"), 0);
        assert.equal(state.gameTimer, null);
        assert.equal(state.updateTimer, null);
        assert.doesNotThrow(() => t.mock.timers.tick(1000));

        game.start();
        assert.equal(seedCalls, 2);
        assert.notEqual(state.core, firstCore);
        assert.equal(sockets.listenerCount("connection"), 1);
    } finally {
        game.dispose();
    }
    game.dispose();
    assert.throws(() => game.start(), /disposed/);
});

test("application: concurrent starts/stops and a later restart close every owned resource", async () => {
    let connects = 0;
    let closes = 0;
    const repository = {
        ...disabledUserRepository,
        async connect() {
            connects++;
        },
        async close() {
            closes++;
        },
    };
    const application = createApplication({ config: config(), userRepository: repository });
    assert.equal(application.httpServer.listening, false, "creating an application does not listen");
    try {
        const [first, duplicate] = await Promise.all([application.start(), application.start()]);
        assert.equal(first.port, duplicate.port);
        assert.equal(connects, 1);
        const http = application.httpServer;
        assert.equal((await fetch(`http://127.0.0.1:${first.port}/game`, { redirect: "manual" })).status, 302);
        await Promise.all([application.stop(), application.stop()]);
        assert.equal(http.listening, false);
        assert.equal(closes, 1);

        const restarted = await application.start();
        assert.notEqual(application.httpServer, http);
        assert.ok(restarted.port > 0);
        assert.equal(connects, 2);
    } finally {
        await application.stop();
    }
    assert.equal(closes, 2);
});

test("application: failed startup closes resources and may be retried", async () => {
    let connects = 0;
    let closes = 0;
    const application = createApplication({
        config: config(),
        userRepository: {
            ...disabledUserRepository,
            async connect() {
                if (++connects === 1) throw new Error("repository unavailable");
            },
            async close() {
                closes++;
            },
        },
    });
    await assert.rejects(application.start(), /repository unavailable/);
    assert.equal(application.httpServer.listening, false);
    assert.equal(closes, 1);
    try {
        assert.ok((await application.start()).port > 0);
    } finally {
        await application.stop();
    }
    assert.equal(closes, 2);
});

test("application/config: production requires persistent sessions, secure cookies and a stable secret", () => {
    assert.throws(() => readApplicationConfig({ NODE_ENV: "production" }), /SESSION_SECRET/);
    const production = {
        NODE_ENV: "production",
        SESSION_SECRET: "x".repeat(32),
        MONGODB_URI: "mongodb://localhost/game",
    };
    assert.throws(() => readApplicationConfig({ ...production, SESSION_STORE: "memory" }), /persistent/);
    assert.throws(() => readApplicationConfig({ ...production, SESSION_COOKIE_SECURE: "false" }), /secure/);
    assert.equal(readApplicationConfig(production).sessionStore, "mongo");
    assert.equal(readApplicationConfig(production).cookieSecure, true);
    for (const port of ["", "-1", "65536", "NaN", "1.5"]) {
        assert.throws(() => readApplicationConfig({ PORT: port }), /PORT/);
    }
    assert.equal(config().port, 0);
});
