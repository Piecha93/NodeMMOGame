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
    PERFORMANCE_MAX_ENEMIES: maximum,
} = require("../dist/shared/gameplay/Performance.js");
const { SocketMsgs } = require("../dist/shared/net/SocketMsgs.js");
const { decodeSnapshotV3 } = require("../dist/shared/protocol/index.js");

function summarize(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return {
        samples: sorted.length,
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
        mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0,
        max: sorted.at(-1) ?? 0,
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
    const world = application.performanceServer;
    let measuring = null;
    let stopping;
    const sample = (diagnostics) => ({ ...diagnostics, tick: diagnostics.serverTick, state: diagnostics.performance });
    const stop = () =>
        (stopping ??= (async () => {
            await application.stop();
        })());
    process.on("message", async (message) => {
        try {
            if (message.kind === "start") {
                const started = sample(await world.beginMeasurement());
                measuring = {
                    started,
                    ordinary: application.gameServer.getDiagnostics(),
                    cpu: process.cpuUsage(),
                };
                process.send({ kind: "reply", id: message.id, value: started });
            } else if (message.kind === "inspect") {
                process.send({ kind: "reply", id: message.id, value: sample(await world.inspect()) });
            } else if (message.kind === "finish") {
                if (!measuring) throw new Error("Measurement has not started");
                const measuredWorld = await world.endMeasurement();
                const ended = sample(measuredWorld.ended);
                const ordinary = application.gameServer.getDiagnostics();
                const measured = measuring;
                measuring = null;
                const ordinaryElapsed = (ordinary.at - measured.ordinary.at) / 1000;
                const ordinaryTicks = (ordinary.serverTick - measured.ordinary.serverTick) >>> 0;
                process.send({
                    kind: "reply",
                    id: message.id,
                    value: {
                        started: measured.started,
                        ended,
                        tickCpuMs: summarize(measuredWorld.tickCpuMs),
                        processCpuMicroseconds: process.cpuUsage(measured.cpu),
                        enemyMin: measuredWorld.enemyMin,
                        enemyMax: measuredWorld.enemyMax,
                        ordinaryWorld: {
                            elapsedSeconds: ordinaryElapsed,
                            ticks: ordinaryTicks,
                            simulationHz: ordinaryTicks / ordinaryElapsed,
                            droppedTimeMs: ordinary.droppedTimeMs - measured.ordinary.droppedTimeMs,
                        },
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
        const diagnostics = await world.inspect();
        process.send({
            kind: "ready",
            port: address.port,
            fixedDeltaMs: diagnostics.performance.tickBudgetMs,
            workerThreadId: diagnostics.threadId,
        });
    } catch (error) {
        process.send({ kind: "error", message: error.stack ?? String(error) });
        await stop();
        process.disconnect();
        process.exitCode = 1;
    }
}

function options() {
    const usage = `Use --count=0..${maximum} --phase=steady|spawn --scenario=static|moving|combat --movement=idle|square --direction-ms=100..10000. For --phase=steady only: --seconds=1..120 --warmup=0..30. For --phase=spawn only: --settle=0..30`;
    const values = new Map();
    for (const argument of process.argv.slice(2)) {
        const match = /^--(count|seconds|warmup|settle|phase|scenario|movement|direction-ms)=([a-z0-9]+)$/.exec(
            argument,
        );
        if (!match || values.has(match[1])) throw new Error(usage);
        values.set(match[1], match[2]);
    }
    const count = Number(values.get("count") ?? 2000);
    const seconds = Number(values.get("seconds") ?? 20);
    const warmup = Number(values.get("warmup") ?? 5);
    const settle = Number(values.get("settle") ?? 3);
    const phase = values.get("phase") ?? "steady";
    const scenario = values.get("scenario") ?? "combat";
    const movement = values.get("movement") ?? "square";
    const directionMs = Number(values.get("direction-ms") ?? 800);
    if (
        ![count, seconds, warmup, settle, directionMs].every(Number.isSafeInteger) ||
        count > maximum ||
        seconds < 1 ||
        seconds > 120 ||
        warmup > 30 ||
        settle > 30 ||
        directionMs < 100 ||
        directionMs > 10_000 ||
        !["steady", "spawn"].includes(phase) ||
        !["static", "moving", "combat"].includes(scenario) ||
        !["idle", "square"].includes(movement)
    )
        throw new Error(usage);
    if (phase === "spawn" && (values.has("seconds") || values.has("warmup")))
        throw new Error(
            "--seconds and --warmup apply only to --phase=steady; spawn measures the complete loading window",
        );
    if (phase === "steady" && values.has("settle"))
        throw new Error("--settle applies only to --phase=spawn; steady uses --seconds and --warmup");
    validatePerformanceConfiguration({ count, distribution: "nearby", scenario });
    return {
        count,
        phase,
        scenario,
        movement,
        directionMs,
        ...(phase === "steady" ? { seconds, warmup } : { settle }),
    };
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
        ((configuration.seconds ?? 0) + (configuration.warmup ?? 0) + (configuration.settle ?? 0) + 180) * 1000,
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
    let ordinarySocket;
    let heartbeat;
    let inputTimer;
    let inputStopped = false;
    let httpProbe = Promise.resolve();
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
        ordinarySocket = io(base, {
            autoConnect: false,
            reconnection: false,
            transports: ["websocket"],
            parser,
            extraHeaders: { Cookie: cookie },
            forceNew: true,
        });
        ordinarySocket.on("connect_error", abort);
        ordinarySocket.on(SocketMsgs.ERROR, (message) => abort(new Error(`Ordinary world error: ${message}`)));
        ordinarySocket.on("disconnect", (reason) => {
            if (!finished) abort(new Error(`Ordinary client disconnected: ${reason}`));
        });
        const ordinaryConnected = waitFor(ordinarySocket, "connect", () => true, cancellation.signal);
        ordinarySocket.connect();
        await ordinaryConnected;
        const ordinaryReady = waitFor(ordinarySocket, SocketMsgs.FIRST_UPDATE_GAME, () => true, cancellation.signal);
        ordinarySocket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [3] });
        await ordinaryReady;
        const heartbeatSent = new Map();
        const heartbeatRtt = [];
        const ordinaryHeartbeatRtt = [];
        const beat = () => {
            const id = Date.now();
            heartbeatSent.set(id, performance.now());
            socket.emit(SocketMsgs.HEARTBEAT, id);
            ordinarySocket.emit(SocketMsgs.HEARTBEAT, id);
            for (const key of heartbeatSent.keys()) if (id - key > 10_000) heartbeatSent.delete(key);
        };
        socket.on(SocketMsgs.HEARTBEAT_RESPONSE, (id) => {
            const sent = heartbeatSent.get(id);
            if (sent !== undefined) {
                heartbeatRtt.push(performance.now() - sent);
            }
        });
        ordinarySocket.on(SocketMsgs.HEARTBEAT_RESPONSE, (id) => {
            const sent = heartbeatSent.get(id);
            if (sent !== undefined) ordinaryHeartbeatRtt.push(performance.now() - sent);
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
        const httpRtt = [];
        httpProbe = (async () => {
            while (!inputStopped) {
                const started = performance.now();
                const response = await fetch(`${base}/game?mode=performance`, {
                    headers: { Cookie: cookie },
                    signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(3000)]),
                });
                await response.arrayBuffer();
                if (!response.ok) throw new Error(`HTTP probe failed: ${response.status}`);
                if (measuring) httpRtt.push(performance.now() - started);
                await delay(500);
            }
        })().catch((error) => {
            if (!finished) abort(error);
        });
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
        let movementStarted;
        let nextInput;
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
            const [horizontal, vertical] =
                configuration.movement === "idle"
                    ? [0, 0]
                    : directions[Math.floor((now - movementStarted) / configuration.directionMs) % 4];
            socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: sequence, horizontal, vertical });
            sequence = (sequence + 1) >>> 0;
            if (measuring) inputCount++;
            nextInput = Math.max(nextInput + initialization.fixedDeltaMs, now);
            inputTimer = setTimeout(sendInput, Math.max(0, nextInput - performance.now()));
        };
        const startInputs = () => {
            movementStarted = performance.now();
            nextInput = movementStarted;
            sendInput();
        };
        const startMeasurement = async () => {
            heartbeatRtt.length = 0;
            ordinaryHeartbeatRtt.length = 0;
            measuredPlayerStart = latestPlayer;
            await request("start");
            measuring = true;
            return performance.now();
        };
        let observedStarted;
        if (configuration.phase === "spawn") {
            observedStarted = await startMeasurement();
            startInputs();
        }
        const populated = waitFor(
            socket,
            PerformanceEvents.STATE,
            (state) =>
                state.count === configuration.count &&
                state.scenario === configuration.scenario &&
                state.pending === 0 &&
                state.enemies === configuration.count,
            cancellation.signal,
            configuration.phase === "spawn" ? Math.min(120_000, 125_000 - configuration.settle * 1000) : 120_000,
        );
        const loadingStarted = performance.now();
        socket.emit(PerformanceEvents.CONFIGURE, {
            count: configuration.count,
            distribution: "nearby",
            scenario: configuration.scenario,
        });
        await populated;
        const loadingElapsedSeconds = (performance.now() - loadingStarted) / 1000;
        let loadingCheckpoint;
        if (configuration.phase === "spawn") {
            loadingCheckpoint = await request("inspect");
            await delay(configuration.settle * 1000, undefined, { signal: cancellation.signal });
        }
        if (configuration.phase === "steady") {
            startInputs();
            await delay(configuration.warmup * 1000, undefined, { signal: cancellation.signal });
            observedStarted = await startMeasurement();
            await delay(configuration.seconds * 1000, undefined, { signal: cancellation.signal });
        }
        const server = await request("finish");
        const observedSeconds = (performance.now() - observedStarted) / 1000;
        measuring = false;
        const elapsedSeconds = (server.ended.at - server.started.at) / 1000;
        const ticks = (server.ended.tick - server.started.tick) >>> 0;
        const nominalHz = 1000 / ready.fixedDeltaMs;
        if (server.ended.state.enemies !== configuration.count || server.ended.state.pending !== 0)
            throw new Error(
                `Enemy population did not finish loading (${server.ended.state.enemies}, pending ${server.ended.state.pending})`,
            );
        if (
            configuration.phase === "steady" &&
            (server.enemyMin !== configuration.count || server.enemyMax !== configuration.count)
        )
            throw new Error(`Enemy population changed during measurement (${server.enemyMin}..${server.enemyMax})`);
        const artifact = await readFile(path.join(root, "dist/server/GameServer.js"));
        return {
            environment: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                clientPid: process.pid,
                serverPid: child.pid,
                workerThreadId: ready.workerThreadId,
                serverArtifactSha256: createHash("sha256").update(artifact).digest("hex"),
            },
            workload: {
                ...configuration,
                distribution: "nearby",
                protocol: 3,
                inputTargetHz: nominalHz,
                ...(configuration.movement === "square"
                    ? { movementDirectionDurationMs: configuration.directionMs }
                    : {}),
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
                droppedTimeAtStartMs: server.started.droppedTimeMs,
                droppedTimeAtEndMs: server.ended.droppedTimeMs,
                enemies: {
                    started: server.started.state.enemies,
                    ended: server.ended.state.enemies,
                    min: Math.min(server.enemyMin, server.started.state.enemies, server.ended.state.enemies),
                    max: Math.max(server.enemyMax, server.started.state.enemies, server.ended.state.enemies),
                },
                ...(configuration.phase === "spawn"
                    ? {
                          loadingElapsedSeconds,
                          settlingSeconds: configuration.settle,
                          loadingCheckpointElapsedSeconds: (loadingCheckpoint.at - server.started.at) / 1000,
                          postLoadingElapsedSeconds: (server.ended.at - loadingCheckpoint.at) / 1000,
                          droppedTimeAtLoadingCheckpointMs: loadingCheckpoint.droppedTimeMs,
                          loadingDroppedTimeMs: loadingCheckpoint.droppedTimeMs - server.started.droppedTimeMs,
                          postLoadingDroppedTimeMs: server.ended.droppedTimeMs - loadingCheckpoint.droppedTimeMs,
                      }
                    : {}),
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
            isolation: {
                ordinaryWorld: server.ordinaryWorld,
                ordinaryHeartbeatRttMs: summarize(ordinaryHeartbeatRtt),
                httpRttMs: summarize(httpRtt),
            },
            telemetry: {
                samples: observedTelemetry.length,
                endingSimulationHz: server.ended.state.simulationHz,
                endingSnapshotHz: server.ended.state.snapshotHz,
                endingTickP50Ms: server.ended.state.tickP50Ms,
                endingTickP95Ms: server.ended.state.tickP95Ms,
            },
            note: `Live wallclock benchmark: authenticated guest over localhost WebSocket, client and server in separate processes, performance simulation in its own worker thread. A second admitted client probes the ordinary world and HTTP is sampled every 500 ms. Actual server ticks and delivered v3 payload bytes are measured; tick CPU samples come from performance telemetry. ${configuration.phase === "spawn" ? `Spawn measurement starts before CONFIGURE and continues for ${configuration.settle} seconds after receiving pending=0 and the requested enemy count and recording a worker checkpoint. Inputs, snapshots, telemetry and probes remain active throughout loading and settling. The 250 ms telemetry broadcast interval and event delivery can extend loadingElapsedSeconds; the loading drop checkpoint also includes the subsequent inspect RPC latency. No warmup is applied.` : "Steady measurement starts after loading and warmup."} Drop totals are never reset: their start/end values and delta are reported. No browser rendering, client prediction or GPU work. Payload bytes exclude transport headers. Enemy combat/friendly-fire rules are unchanged and the player sends no shots.`,
        };
    } catch (error) {
        if (diagnostics.trim()) console.error(diagnostics.trim());
        if (cancellation.signal.aborted) throw cancellation.signal.reason;
        throw error;
    } finally {
        finished = true;
        inputStopped = true;
        clearTimeout(inputTimer);
        clearInterval(heartbeat);
        socket?.disconnect();
        ordinarySocket?.disconnect();
        await httpProbe;
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
} else if (process.argv.length === 3 && process.argv[2] === "--help") {
    console.log(`Usage: node scripts/benchmark-server.mjs [options]

  --count=0..${maximum}              Enemy population (default: 2000)
  --phase=steady|spawn              Measure a loaded world or complete spawning (default: steady)
  --scenario=static|moving|combat   Enemy behavior (default: combat)
  --movement=idle|square            Player input at the fixed simulation rate (default: square)
  --direction-ms=100..10000         Square direction duration (default: 800)
  --seconds=1..120                  Steady measurement duration (default: 20)
  --warmup=0..30                    Steady warmup after loading (default: 5)
  --settle=0..30                    Spawn observation after loading checkpoint (default: 3)

Spawn starts measurement and player input before configuring the population.
It records a checkpoint when telemetry reports pending=0 and the requested count,
then continues measuring for --settle seconds. The loading checkpoint includes
the telemetry interval and inspect RPC latency. Loading times out after
min(120, 125 - settle) seconds to keep the worker measurement bounded.
--seconds and --warmup are rejected for spawn; --settle is rejected for steady.`);
} else {
    try {
        console.log(JSON.stringify(await benchmark(), null, 2));
    } catch (error) {
        console.error(error.stack ?? String(error));
        process.exitCode = 1;
    }
}
