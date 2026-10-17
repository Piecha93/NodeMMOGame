import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Worker } from "node:worker_threads";
import test from "node:test";
import { Namespace, Server, Socket } from "socket.io";
import { io, Manager } from "socket.io-client";
import { PerformanceWorkerHost } from "../../server/workers/PerformanceWorkerHost";
import { HostMessage } from "../../server/workers/protocol";
import { GameServer } from "../../server/GameServer";
import { createApplication } from "../../server/Application";
import { readApplicationConfig } from "../../server/ServerConfig";
import { SocketMsgs } from "../../shared/net/SocketMsgs";

class WorkerProbe extends EventEmitter {
    threadId = 999;
    terminated = false;
    deliver = false;
    readonly sent: HostMessage[] = [];
    postMessage(message: HostMessage): void {
        this.sent.push(message);
        if (message.type === "stop") queueMicrotask(() => this.emit("message", { type: "stopped" }));
        if (message.type === "delivery" && this.deliver)
            queueMicrotask(() => this.emit("message", { type: "delivered", id: message.id }));
    }
    async terminate(): Promise<number> {
        this.terminated = true;
        this.threadId = -1;
        this.emit("exit", 0);
        return 0;
    }
}

class SocketProbe extends EventEmitter {
    connected = true;
    readonly request = { session: { user_id: "Guest lifecycle" } };
    readonly conn = new EventEmitter();
    readonly sent: Array<{ event: string; args: unknown[] }> = [];
    compress(): this {
        return this;
    }
    override emit(event: string, ...args: unknown[]): boolean {
        this.sent.push({ event, args });
        return true;
    }
    receive(event: string, value?: unknown): void {
        super.emit(event, value);
    }
    disconnect(): this {
        if (this.connected) {
            this.connected = false;
            super.emit("disconnect", "test disconnect");
        }
        return this;
    }
}

function fixture(options: ConstructorParameters<typeof PerformanceWorkerHost>[1] = {}) {
    const namespace = new EventEmitter();
    const worker = new WorkerProbe();
    const host = new PerformanceWorkerHost(namespace as unknown as Namespace, {
        shutdownTimeoutMs: 30,
        ...options,
        workerFactory: () => worker as unknown as Worker,
    });
    return { namespace, worker, host };
}

test("worker lifecycle: startup timeout terminates the worker, rejects concurrent starts and installs no admission listener", async () => {
    const { namespace, worker, host } = fixture({ startupTimeoutMs: 20 });
    try {
        const first = host.start();
        const second = host.start();
        await Promise.all([assert.rejects(first, /startup timed out/), assert.rejects(second, /startup timed out/)]);
        assert.equal(host.running, false);
        assert.equal(namespace.listenerCount("connection"), 0);
        await assert.rejects(host.inspect(), /startup timed out/);
    } finally {
        await host.dispose();
    }
    assert.equal(worker.terminated, true);
    assert.equal(host.threadId, null);
});

test("worker lifecycle: failure rejects diagnostic requests and closes only its namespace before an idempotent disposal", async () => {
    const { namespace, worker, host } = fixture({ requestTimeoutMs: 20 });
    const started = host.start();
    worker.emit("message", { type: "ready" });
    await started;
    const socket = new SocketProbe();
    namespace.emit("connection", socket);
    await assert.rejects(host.inspect(), /request timed out/);
    assert.equal(host.running, true, "a bounded diagnostic timeout does not kill a healthy worker");
    const rejected = assert.rejects(host.inspect(), /worker crashed/);
    worker.emit("error", new Error("worker crashed"));
    await rejected;
    assert.equal(socket.connected, false);
    const late = new SocketProbe();
    namespace.emit("connection", late);
    assert.equal(late.connected, false, "new authenticated connections are rejected after the worker fails");
    assert.equal(host.running, false);
    await Promise.all([host.dispose(), host.dispose()]);
    assert.equal(namespace.listenerCount("connection"), 0);
    assert.equal(host.threadId, null);
    assert.equal(worker.listenerCount("message"), 0);
});

test("worker backpressure: stalled delivery bounds an offender's input without dropping other connections", async () => {
    const { namespace, worker, host } = fixture({ maxPendingMessagesPerClient: 4 });
    const started = host.start();
    worker.emit("message", { type: "ready" });
    await started;
    try {
        const offender = new SocketProbe();
        const observer = new SocketProbe();
        namespace.emit("connection", offender);
        namespace.emit("connection", observer);
        for (let seq = 0; seq < 5; seq++)
            offender.receive(SocketMsgs.INPUT_SNAPSHOT, { seq, horizontal: 0, vertical: 0 });
        assert.equal(offender.connected, false);
        assert.equal(observer.connected, true);
        assert.equal(offender.listenerCount(SocketMsgs.INPUT_SNAPSHOT), 0);
        assert.equal(
            worker.sent.filter((message) => message.type === "delivery").length,
            1,
            "unacknowledged deliveries cannot grow without bound",
        );
        worker.deliver = true;
        const first = worker.sent.find((message) => message.type === "delivery");
        assert.ok(first && first.type === "delivery");
        worker.emit("message", { type: "delivered", id: first.id });
        await delay(0);
        const deliveries = worker.sent.filter((message) => message.type === "delivery");
        const connected = deliveries
            .flatMap((message) => message.messages)
            .filter((message) => message.type === "connect");
        assert.equal(connected.length, 2);
        const observerId = connected[1]!.clientId;
        worker.emit("message", {
            type: "output",
            id: 900,
            clientId: observerId,
            event: SocketMsgs.HEARTBEAT_RESPONSE,
            args: [123],
        });
        assert.ok(
            observer.sent.some((message) => message.event === SocketMsgs.HEARTBEAT_RESPONSE && message.args[0] === 123),
        );
        assert.ok(worker.sent.some((message) => message.type === "received" && message.id === 900));
        assert.equal(observer.connected, true);
    } finally {
        await host.dispose();
    }
});

test("worker diagnostics: timed-out requests retain their bounded quota until a late response arrives", async () => {
    const { worker, host } = fixture({ requestTimeoutMs: 10 });
    const started = host.start();
    worker.emit("message", { type: "ready" });
    await started;
    try {
        await Promise.all(Array.from({ length: 16 }, () => assert.rejects(host.inspect(), /request timed out/)));
        await assert.rejects(host.inspect(), /Too many/);
        const first = worker.sent.find((message) => message.type === "request");
        assert.ok(first && first.type === "request");
        worker.emit("message", { type: "response", id: first.id, value: {} });
        await assert.rejects(host.inspect(), /request timed out/);
        assert.equal(worker.sent.filter((message) => message.type === "request").length, 17);
    } finally {
        await host.dispose();
    }
});

test("worker admission: a lookup timeout cannot release the quota for an unresolved main-process database operation", async () => {
    const resolvers: Array<(value: { id: string; username: string }) => void> = [];
    const { namespace, worker, host } = fixture({
        maxPendingConnections: 1,
        admissionTimeoutMs: 10,
        userRepository: {
            findUserById() {
                return new Promise((resolve) => resolvers.push(resolve));
            },
        },
    });
    const started = host.start();
    worker.emit("message", { type: "ready" });
    await started;
    try {
        const first = new SocketProbe();
        first.request.session.user_id = "registered-first";
        namespace.emit("connection", first);
        await delay(20);
        assert.equal(first.connected, false);
        const rejected = new SocketProbe();
        rejected.request.session.user_id = "registered-second";
        namespace.emit("connection", rejected);
        await delay(0);
        assert.equal(rejected.connected, false);
        assert.equal(resolvers.length, 1, "a slow repository cannot accumulate abandoned parallel lookups");
        resolvers[0]!({ id: "registered-first", username: "First" });
        await delay(0);
        const admitted = new SocketProbe();
        admitted.request.session.user_id = "registered-third";
        namespace.emit("connection", admitted);
        await delay(0);
        assert.equal(resolvers.length, 2);
        resolvers[1]!({ id: "registered-third", username: "Third" });
        await delay(0);
        assert.equal(admitted.connected, true);
    } finally {
        for (const resolve of resolvers) resolve({ id: "cleanup", username: "Cleanup" });
        await host.dispose();
    }
});

test("worker output backpressure: withholding delivery ACKs bounds in-flight snapshots and disconnects instead of losing deltas", {
    timeout: 15_000,
}, async (t) => {
    const worker = new Worker(join(__dirname, "../../server/workers/PerformanceWorker.js"));
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    t.after(async () => {
        clearInterval(heartbeat);
        await worker.terminate();
    });
    await new Promise<void>((resolve, reject) => {
        worker.once("message", () => resolve());
        worker.once("error", reject);
    });
    let outputs = 0;
    const disconnected = new Promise<void>((resolve) =>
        worker.on("message", (message) => {
            if (message.type === "output") outputs++;
            if (message.type === "disconnect" && message.clientId === "backpressure-client") resolve();
        }),
    );
    worker.postMessage({
        type: "delivery",
        id: 1,
        messages: [
            { type: "connect", clientId: "backpressure-client", userId: "Guest output backpressure" },
            {
                type: "event",
                clientId: "backpressure-client",
                event: SocketMsgs.CLIENT_READY,
                payload: { supportedProtocolVersions: [3] },
            },
        ],
    } satisfies HostMessage);
    let deliveryId = 10;
    heartbeat = setInterval(
        () =>
            worker.postMessage({
                type: "delivery",
                id: deliveryId++,
                messages: [
                    {
                        type: "event",
                        clientId: "backpressure-client",
                        event: SocketMsgs.HEARTBEAT,
                        payload: Date.now(),
                    },
                ],
            } satisfies HostMessage),
        1000,
    );
    await disconnected;
    assert.ok(outputs > 0);
    assert.ok(outputs <= 32, "missing output acknowledgements cannot grow the worker-to-main in-flight set");
    const diagnostics = new Promise<{ clients: number; performance: { objects: number } }>((resolve) =>
        worker.on("message", (message) => {
            if (message.type === "response" && message.id === 2) resolve(message.value);
        }),
    );
    worker.postMessage({ type: "request", id: 2, action: "inspect" } satisfies HostMessage);
    const state = await diagnostics;
    assert.equal(state.clients, 0);
    assert.equal(state.performance.objects, 0);
});

test("application worker lifecycle: failed worker startup closes HTTP and repository resources and a retry starts a new worker", async () => {
    let attempts = 0;
    const application = createApplication({
        config: readApplicationConfig({
            NODE_ENV: "test",
            HOST: "127.0.0.1",
            PORT: "0",
            DEMO_SCENARIO: "none",
            ENABLE_PERF_TESTS: "true",
        }),
        performanceServerFactory(namespace, options) {
            if (attempts++ === 0)
                return new PerformanceWorkerHost(namespace, {
                    ...options,
                    workerFactory() {
                        throw new Error("worker construction failed");
                    },
                });
            return new PerformanceWorkerHost(namespace, options);
        },
    });
    try {
        await assert.rejects(application.start(), /worker construction failed/);
        assert.equal(application.httpServer.listening, false);
        assert.equal(application.performanceServer?.running, false);
        assert.ok((await application.start()).port > 0);
        assert.equal(application.performanceServer?.running, true);
        assert.ok(application.performanceServer);
        assert.equal((await application.performanceServer.inspect()).performance.objects, 0);
    } finally {
        await application.stop();
    }
});

test("worker failure: reconnecting to the unavailable namespace is rejected while its shared ordinary connection stays alive", {
    timeout: 10_000,
}, async (t) => {
    const parser = require("socket.io-msgpack-parser");
    const worker = new WorkerProbe();
    const application = createApplication({
        config: readApplicationConfig({
            NODE_ENV: "test",
            HOST: "127.0.0.1",
            PORT: "0",
            DEMO_SCENARIO: "none",
            ENABLE_PERF_TESTS: "true",
        }),
        performanceServerFactory(namespace, options) {
            return new PerformanceWorkerHost(namespace, {
                ...options,
                workerFactory() {
                    queueMicrotask(() => worker.emit("message", { type: "ready" }));
                    return worker as unknown as Worker;
                },
            });
        },
    });
    let manager: Manager | undefined;
    t.after(async () => {
        manager?.socket("/performance").disconnect();
        manager?.socket("/").disconnect();
        await application.stop();
    });
    const { port } = await application.start();
    const base = `http://127.0.0.1:${port}`;
    const login = await fetch(`${base}/login`, {
        method: "POST",
        redirect: "manual",
        body: new URLSearchParams({ username: "guest", password: "guest" }),
    });
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    manager = new Manager(base, {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
        parser,
        extraHeaders: { Cookie: cookie },
    });
    const ordinary = manager.socket("/");
    const performance = manager.socket("/performance");
    const connect = (socket: typeof ordinary) =>
        new Promise<void>((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
            socket.connect();
        });
    await connect(ordinary);
    await connect(performance);
    assert.equal(ordinary.io, performance.io, "both namespaces intentionally share one Engine.IO connection");
    const firstError = new Promise<string>((resolve) => performance.once(SocketMsgs.ERROR, resolve));
    const firstClosed = new Promise<void>((resolve) => performance.once("disconnect", () => resolve()));
    worker.emit("error", new Error("fixture worker failure"));
    assert.match(await firstError, /unavailable/i);
    await firstClosed;
    assert.equal(ordinary.connected, true);
    const reconnectError = new Promise<string>((resolve) => performance.once(SocketMsgs.ERROR, resolve));
    const reconnectClosed = new Promise<void>((resolve) => performance.once("disconnect", () => resolve()));
    await connect(performance);
    assert.match(await reconnectError, /unavailable|stopped/i);
    await reconnectClosed;
    assert.equal(ordinary.connected, true);
    const echo = new Promise<number>((resolve) => ordinary.once(SocketMsgs.HEARTBEAT_RESPONSE, resolve));
    ordinary.emit(SocketMsgs.HEARTBEAT, 789);
    assert.equal(await echo, 789);
});

test("worker isolation: HTTP, ordinary-game heartbeats and snapshots complete while the performance worker is blocked", {
    timeout: 15_000,
}, async (t) => {
    const parser = require("socket.io-msgpack-parser");
    const http = createServer((_request, response) => response.end("main responsive"));
    const sockets = new Server(http, { parser });
    sockets.use((socket, next) => {
        (socket.request as typeof socket.request & { session: { user_id: string } }).session = {
            user_id: "Guest main isolation",
        };
        next();
    });
    const ordinary = new GameServer(sockets);
    let worker: Worker | undefined;
    const host = new PerformanceWorkerHost(sockets.of("/performance"), {
        workerFactory() {
            worker = new Worker(join(__dirname, "../fixtures/stalled-performance-worker.js"));
            return worker;
        },
    });
    const signal = new Int32Array(new SharedArrayBuffer(8));
    let client: ReturnType<typeof io> | undefined;
    t.after(async () => {
        Atomics.store(signal, 0, 1);
        Atomics.notify(signal, 0);
        client?.disconnect();
        ordinary.dispose();
        await host.dispose();
        await sockets.close();
        http.closeAllConnections();
    });
    ordinary.start();
    await host.start();
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    client = io(base, { autoConnect: false, reconnection: false, transports: ["websocket"], parser });
    await new Promise<void>((resolve, reject) => {
        client!.once("connect", resolve);
        client!.once("connect_error", reject);
        client!.connect();
    });
    const first = new Promise<void>((resolve) => client!.once(SocketMsgs.FIRST_UPDATE_GAME, () => resolve()));
    client.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [3] });
    await first;
    assert.ok(worker);
    worker.postMessage({ type: "test:stall", signal: signal.buffer });
    for (let attempt = 0; Atomics.load(signal, 1) === 0 && attempt < 1000; attempt++) await delay(1);
    assert.equal(Atomics.load(signal, 1), 1, "the fixture has entered its blocking worker section");
    let inspected = false;
    const inspection = host.inspect().then((state) => {
        inspected = true;
        return state;
    });
    const heartbeat = new Promise<number>((resolve) => client!.once(SocketMsgs.HEARTBEAT_RESPONSE, resolve));
    const snapshot = new Promise<unknown>((resolve) => client!.once(SocketMsgs.UPDATE_GAME, resolve));
    client.emit(SocketMsgs.HEARTBEAT, 456);
    const [response, echo, update] = await Promise.all([fetch(base), heartbeat, snapshot]);
    assert.equal(await response.text(), "main responsive");
    assert.equal(echo, 456);
    assert.ok(Array.isArray(update));
    assert.equal(inspected, false, "the worker is still blocked when main-process work completes");
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
    assert.equal((await inspection).threadId, host.threadId);
});
