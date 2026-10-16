import { fork } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const {
    PerformanceEvents,
    validatePerformanceConfiguration,
    ...performanceContract
} = require("../dist/shared/gameplay/Performance.js");
const { SocketMsgs } = require("../dist/shared/net/SocketMsgs.js");
const { decodeSnapshotV3 } = require("../dist/shared/protocol/index.js");
// Older build artifacts can still be measured before rebuilding the optimized source.
const maximum = performanceContract.PERFORMANCE_MAX_ENEMIES ?? Math.max(...performanceContract.PERFORMANCE_COUNTS);

function summarize(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return {
        samples: sorted.length,
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
        mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0,
    };
}

async function childServer() {
    const { createApplication } = require("../dist/server/Application.js");
    const { readApplicationConfig } = require("../dist/server/ServerConfig.js");
    const application = createApplication({
        projectRoot: root,
        config: readApplicationConfig({
            NODE_ENV: "test",
            HOST: "127.0.0.1",
            PORT: "0",
            SESSION_STORE: "memory",
            SESSION_SECRET: randomBytes(32).toString("hex"),
            DEMO_SCENARIO: "none",
            ENABLE_PERF_TESTS: "true",
        }),
    });
    let measuring = null;
    let stopping;
    const core = application.performanceServer.core;
    const population = application.performanceServer.performance;
    const telemetry = application.performanceServer.performanceMetrics;
    const unsubscribe = core.subscribeAfterStep(() => {
        if (!measuring) return;
        const duration = population.tickSamples.at(-1);
        if (Number.isFinite(duration)) measuring.tickCpu.push(duration);
        measuring.enemyMin = Math.min(measuring.enemyMin, population.enemies.size);
        measuring.enemyMax = Math.max(measuring.enemyMax, population.enemies.size);
    });
    const sample = () => ({
        at: performance.now(),
        tick: core.Runtime.tick,
        droppedTimeMs: core.droppedTimeMs,
        state: population.state(0, telemetry.read()),
    });
    const stop = () =>
        (stopping ??= (async () => {
            unsubscribe();
            await application.stop();
        })());
    process.on("message", async (message) => {
        try {
            if (message.kind === "start") {
                const started = sample();
                measuring = {
                    started,
                    tickCpu: [],
                    enemyMin: started.state.enemies,
                    enemyMax: started.state.enemies,
                    cpu: process.cpuUsage(),
                };
                process.send({ kind: "reply", id: message.id, value: started });
            } else if (message.kind === "finish") {
                if (!measuring) throw new Error("Measurement has not started");
                const ended = sample();
                const measured = measuring;
                measuring = null;
                process.send({
                    kind: "reply",
                    id: message.id,
                    value: {
                        started: measured.started,
                        ended,
                        tickCpuMs: summarize(measured.tickCpu),
                        processCpuMicroseconds: process.cpuUsage(measured.cpu),
                        enemyMin: measured.enemyMin,
                        enemyMax: measured.enemyMax,
                    },
                });
            } else if (message.kind === "stop") {
                await stop();
                process.send({ kind: "reply", id: message.id, value: null }, () => process.disconnect());
            }
        } catch (error) {
            process.send?.({ kind: "error", message: error.stack ?? String(error) });
        }
    });
    process.once("disconnect", () => void stop());
    process.once("SIGTERM", () => void stop().then(() => process.exit(0)));
    try {
        const address = await application.start();
        process.send({ kind: "ready", port: address.port, fixedDeltaMs: core.Runtime.config.fixedDeltaMs });
    } catch (error) {
        process.send({ kind: "error", message: error.stack ?? String(error) });
        await stop();
        process.disconnect();
        process.exitCode = 1;
    }
}

function options() {
    const values = new Map();
    for (const argument of process.argv.slice(2)) {
        const match = /^--(count|seconds|warmup)=(\d+)$/.exec(argument);
        if (!match || values.has(match[1]))
            throw new Error(`Use --count=0..${maximum} --seconds=1..120 --warmup=0..30`);
        values.set(match[1], Number(match[2]));
    }
    const count = values.get("count") ?? 2000;
    const seconds = values.get("seconds") ?? 20;
    const warmup = values.get("warmup") ?? 5;
    if (
        ![count, seconds, warmup].every(Number.isSafeInteger) ||
        count > maximum ||
        seconds < 1 ||
        seconds > 120 ||
        warmup > 30
    )
        throw new Error(`Use --count=0..${maximum} --seconds=1..120 --warmup=0..30`);
    validatePerformanceConfiguration({ count, distribution: "nearby", scenario: "combat" });
    return { count, seconds, warmup };
}

function waitFor(emitter, event, predicate, signal, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error(`Timeout waiting for ${event}`)), timeoutMs);
        const received = (value) => {
            if (predicate(value)) finish(null, value);
        };
        const failed = (error) => finish(error instanceof Error ? error : new Error(String(error)));
        const aborted = () => finish(signal.reason);
        const finish = (error, value) => {
            clearTimeout(timer);
            emitter.off(event, received);
            emitter.off("error", failed);
            signal.removeEventListener("abort", aborted);
            if (error) reject(error);
            else resolve(value);
        };
        emitter.on(event, received);
        emitter.on("error", failed);
        signal.addEventListener("abort", aborted, { once: true });
        if (signal.aborted) aborted();
    });
}

async function benchmark() {
    const configuration = options();
    const { io } = require("socket.io-client");
    const parser = require("socket.io-msgpack-parser");
    const cancellation = new AbortController();
    const abort = (reason) => {
        if (!cancellation.signal.aborted)
            cancellation.abort(reason instanceof Error ? reason : new Error(String(reason)));
    };
    const interrupt = () => abort(new Error("Benchmark interrupted"));
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    const lifetime = setTimeout(
        () => abort(new Error("Benchmark exceeded its total timeout")),
        (configuration.seconds + configuration.warmup + 180) * 1000,
    );
    const child = fork(fileURLToPath(import.meta.url), ["--child"], {
        cwd: root,
        execArgv: [],
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        windowsHide: true,
    });
    let diagnostics = "";
    for (const stream of [child.stdout, child.stderr])
        stream.on("data", (chunk) => {
            diagnostics = (diagnostics + chunk).slice(-8000);
        });
    let finished = false;
    const childExit = (code, signal) => {
        if (!finished) abort(new Error(`Server process exited (${signal ?? code})`));
    };
    child.once("exit", childExit);
    child.on("message", (message) => {
        if (message.kind === "error") abort(new Error(message.message));
    });
    let requestId = 0;
    const request = async (kind, signal = cancellation.signal) => {
        const id = requestId++;
        const result = waitFor(child, "message", (message) => message.kind === "reply" && message.id === id, signal);
        child.send({ kind, id });
        return (await result).value;
    };
    let socket;
    let heartbeat;
    let inputTimer;
    let inputStopped = false;
    try {
        const ready = await waitFor(child, "message", (message) => message.kind === "ready", cancellation.signal);
        const base = `http://127.0.0.1:${ready.port}`;
        const login = await fetch(`${base}/login?mode=performance`, {
            method: "POST",
            redirect: "manual",
            body: new URLSearchParams({ username: "guest", password: "guest" }),
            signal: cancellation.signal,
        });
        const cookie = login.headers.get("set-cookie")?.split(";")[0];
        if (login.status !== 302 || !cookie) throw new Error("Guest benchmark login failed");
        socket = io(`${base}/performance`, {
            autoConnect: false,
            reconnection: false,
            transports: ["websocket"],
            parser,
            extraHeaders: { Cookie: cookie },
        });
        socket.on("connect_error", abort);
        socket.on(SocketMsgs.ERROR, (message) => abort(new Error(`Game error: ${message}`)));
        socket.on("disconnect", (reason) => {
            if (!finished) abort(new Error(`Client disconnected: ${reason}`));
        });
        const connected = waitFor(socket, "connect", () => true, cancellation.signal);
        socket.connect();
        await connected;
        const heartbeatSent = new Map();
        const heartbeatRtt = [];
        const beat = () => {
            const id = Date.now();
            heartbeatSent.set(id, performance.now());
            socket.emit(SocketMsgs.HEARTBEAT, id);
            for (const key of heartbeatSent.keys()) if (id - key > 10_000) heartbeatSent.delete(key);
        };
        socket.on(SocketMsgs.HEARTBEAT_RESPONSE, (id) => {
            const sent = heartbeatSent.get(id);
            if (sent !== undefined) {
                heartbeatRtt.push(performance.now() - sent);
                heartbeatSent.delete(id);
            }
        });
        heartbeat = setInterval(beat, 1000);
        beat();
        let measuring = false;
        let snapshots = 0;
        let payloadBytes = 0;
        let inputCount = 0;
        let latestPlayer;
        let measuredPlayerStart;
        let lastAck = null;
        const observedTelemetry = [];
        socket.on(PerformanceEvents.STATE, (state) => {
            if (measuring) observedTelemetry.push(state);
        });
        const receiveSnapshot = (frames) => {
            try {
                const normalized = frames.map((frame) =>
                    frame instanceof ArrayBuffer
                        ? frame
                        : frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength),
                );
                const state = decodeSnapshotV3(normalized);
                if (state.localPlayerState)
                    latestPlayer = { x: state.localPlayerState.transform.x, y: state.localPlayerState.transform.y };
                lastAck = state.lastProcessedInputSeq;
                if (measuring) {
                    snapshots++;
                    payloadBytes += normalized.reduce((bytes, frame) => bytes + frame.byteLength, 0);
                }
            } catch (error) {
                abort(error);
            }
        };
        socket.on(SocketMsgs.FIRST_UPDATE_GAME, receiveSnapshot);
        socket.on(SocketMsgs.UPDATE_GAME, receiveSnapshot);
        const initialized = waitFor(socket, SocketMsgs.INITIALIZE_GAME, () => true, cancellation.signal);
        const first = waitFor(socket, SocketMsgs.FIRST_UPDATE_GAME, () => true, cancellation.signal);
        socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [3] });
        const [initialization] = await Promise.all([initialized, first]);
        if (initialization.protocolVersion !== 3) throw new Error("Benchmark requires protocol v3");
        const populated = waitFor(
            socket,
            PerformanceEvents.STATE,
            (state) =>
                state.count === configuration.count && state.pending === 0 && state.enemies === configuration.count,
            cancellation.signal,
            120_000,
        );
        socket.emit(PerformanceEvents.CONFIGURE, {
            count: configuration.count,
            distribution: "nearby",
            scenario: "combat",
        });
        await populated;
        const movementStarted = performance.now();
        let nextInput = movementStarted;
        let sequence = 0;
        const directions = [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
        ];
        const sendInput = () => {
            if (inputStopped) return;
            const now = performance.now();
            const [horizontal, vertical] = directions[Math.floor((now - movementStarted) / 800) % 4];
            socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: sequence, horizontal, vertical });
            sequence = (sequence + 1) >>> 0;
            if (measuring) inputCount++;
            nextInput = Math.max(nextInput + initialization.fixedDeltaMs, now);
            inputTimer = setTimeout(sendInput, Math.max(0, nextInput - performance.now()));
        };
        sendInput();
        await delay(configuration.warmup * 1000, undefined, { signal: cancellation.signal });
        heartbeatRtt.length = 0;
        measuredPlayerStart = latestPlayer;
        await request("start");
        const observedStarted = performance.now();
        measuring = true;
        await delay(configuration.seconds * 1000, undefined, { signal: cancellation.signal });
        const server = await request("finish");
        const observedSeconds = (performance.now() - observedStarted) / 1000;
        measuring = false;
        const elapsedSeconds = (server.ended.at - server.started.at) / 1000;
        const ticks = (server.ended.tick - server.started.tick) >>> 0;
        const nominalHz = 1000 / ready.fixedDeltaMs;
        if (server.enemyMin !== configuration.count || server.enemyMax !== configuration.count)
            throw new Error(`Enemy population changed during measurement (${server.enemyMin}..${server.enemyMax})`);
        const artifact = await readFile(path.join(root, "dist/server/GameServer.js"));
        return {
            environment: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                clientPid: process.pid,
                serverPid: child.pid,
                serverArtifactSha256: createHash("sha256").update(artifact).digest("hex"),
            },
            workload: {
                ...configuration,
                scenario: "combat",
                distribution: "nearby",
                protocol: 3,
                inputTargetHz: nominalHz,
                movement: "square, 800 ms per direction",
                playerShoots: false,
                browserRenderer: false,
            },
            server: {
                elapsedSeconds,
                ticks,
                simulationHz: ticks / elapsedSeconds,
                nominalHz,
                percentOfNominal: (ticks / elapsedSeconds / nominalHz) * 100,
                tickCpuMs: server.tickCpuMs,
                snapshotP95Ms: server.ended.state.snapshotP95Ms,
                processCpuMicroseconds: server.processCpuMicroseconds,
                droppedTimeMs: server.ended.droppedTimeMs - server.started.droppedTimeMs,
                enemies: { min: server.enemyMin, max: server.enemyMax },
                endingObjects: server.ended.state.objects,
            },
            clientObserved: {
                elapsedSeconds: observedSeconds,
                snapshots,
                snapshotHz: snapshots / observedSeconds,
                payloadBytes,
                payloadBytesPerSecond: payloadBytes / observedSeconds,
                payloadKiBPerSecond: payloadBytes / observedSeconds / 1024,
                inputs: inputCount,
                inputHz: inputCount / observedSeconds,
                lastAck,
                heartbeatRttMs: summarize(heartbeatRtt),
                playerStart: measuredPlayerStart,
                playerEnd: latestPlayer,
            },
            telemetry: {
                samples: observedTelemetry.length,
                endingSimulationHz: server.ended.state.simulationHz,
                endingSnapshotHz: server.ended.state.snapshotHz,
                endingTickP50Ms: server.ended.state.tickP50Ms,
                endingTickP95Ms: server.ended.state.tickP95Ms,
            },
            note: "Live wallclock benchmark: authenticated guest over localhost WebSocket, client and server in separate processes. Actual server ticks and delivered v3 payload bytes are measured; CPU tick samples come from the same timer as performance telemetry. Snapshot CPU p95 uses the latest bounded server telemetry window. No browser rendering, client prediction or GPU work. Payload bytes exclude transport headers. Enemy combat/friendly-fire rules are unchanged and the player sends no shots.",
        };
    } catch (error) {
        if (diagnostics.trim()) console.error(diagnostics.trim());
        throw error;
    } finally {
        finished = true;
        inputStopped = true;
        clearTimeout(inputTimer);
        clearInterval(heartbeat);
        socket?.disconnect();
        try {
            if (child.connected) await request("stop", AbortSignal.timeout(15_000));
        } catch {
            child.kill();
        }
        clearTimeout(lifetime);
        process.off("SIGINT", interrupt);
        process.off("SIGTERM", interrupt);
        child.off("exit", childExit);
    }
}

if (process.argv.includes("--child") && typeof process.send === "function") {
    await childServer();
} else {
    try {
        console.log(JSON.stringify(await benchmark(), null, 2));
    } catch (error) {
        console.error(error.stack ?? String(error));
        process.exitCode = 1;
    }
}
