import { parentPort, threadId } from "node:worker_threads";
import { GameServer } from "../GameServer";
import { GameConnection, GameTransport } from "../transport/GameTransport";
import { PerformanceEvents } from "../../shared/gameplay/Performance";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { dtoBytes, HostMessage, InboundCommand, WorkerDiagnostics, WorkerMeasurement, WorldMessage } from "./protocol";

const port = parentPort;
if (!port) throw new Error("PerformanceWorker must run in a worker thread");
const MAX_OUTPUT_MESSAGES_PER_CLIENT = 128;
const MAX_OUTPUT_BYTES_PER_CLIENT = 8 * 1024 * 1024;
const MAX_OUTPUT_IN_FLIGHT = 32;
const MAX_OUTPUT_IN_FLIGHT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_OUTPUT_MESSAGES = 4096;
const MAX_MEASUREMENT_SAMPLES = 16_384;
// Leave time for benchmark RPCs around the supported 120-second measurement.
const MAX_MEASUREMENT_MS = 130_000;
const FORWARDED_EVENTS = new Set<string>([
    SocketMsgs.CLIENT_READY,
    SocketMsgs.INPUT_SNAPSHOT,
    SocketMsgs.HEARTBEAT,
    SocketMsgs.CHAT_MESSAGE,
    PerformanceEvents.CONFIGURE,
]);

interface Output {
    readonly id: number;
    readonly clientId: string;
    readonly event: string;
    readonly args: unknown[];
    readonly bytes: number;
}

class WorkerConnection implements GameConnection {
    readonly request: { session: { user_id: string } };
    connected = true;
    private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor(
        readonly id: string,
        userId: string,
        readonly displayName?: string,
    ) {
        this.request = { session: { user_id: userId } };
    }
    compress(): this {
        return this;
    }
    on(event: string, listener: (...args: unknown[]) => void): this {
        let handlers = this.listeners.get(event);
        if (!handlers) {
            handlers = new Set();
            this.listeners.set(event, handlers);
        }
        handlers.add(listener);
        return this;
    }
    emit(event: string, ...args: unknown[]): boolean {
        if (!this.connected || stopping) return false;
        output(this, event, args);
        return true;
    }
    receive(event: string, payload?: unknown): void {
        if (!this.connected) return;
        for (const handler of this.listeners.get(event) ?? []) handler(payload);
    }
    disconnect(): this {
        if (!this.connected) return this;
        this.connected = false;
        transport.connections.delete(this.id);
        discardQueuedOutput(this.id);
        const handlers = [...(this.listeners.get(SocketMsgs.DISCONNECT) ?? [])];
        this.listeners.clear();
        for (const handler of handlers) handler("worker disconnect");
        if (!stopping) send({ type: "disconnect", clientId: this.id });
        return this;
    }
}

class WorkerTransport implements GameTransport {
    readonly connections = new Map<string, WorkerConnection>();
    private readonly listeners = new Set<(socket: GameConnection) => void>();
    on(_event: "connection", listener: (socket: GameConnection) => void): this {
        this.listeners.add(listener);
        return this;
    }
    off(_event: "connection", listener: (socket: GameConnection) => void): this {
        this.listeners.delete(listener);
        return this;
    }
    emit(event: string, ...args: unknown[]): boolean {
        // A broadcast must give every recipient its own transferable buffer ownership.
        for (const socket of [...this.connections.values()]) socket.emit(event, ...structuredClone(args));
        return true;
    }
    connect(command: Extract<InboundCommand, { type: "connect" }>): void {
        if (this.connections.has(command.clientId)) throw new Error("Duplicate worker connection");
        const socket = new WorkerConnection(command.clientId, command.userId, command.displayName);
        this.connections.set(socket.id, socket);
        for (const listener of this.listeners) listener(socket);
    }
}

const transport = new WorkerTransport();
const server = new GameServer(transport, { performance: true });
let stopping = false;
let nextOutputId = 0;
let outputQueue: Output[] = [];
let outputInFlightBytes = 0;
let totalOutputBytes = 0;
let totalOutputMessages = 0;
const outputsInFlight = new Map<number, Output>();
const clientOutput = new Map<string, { count: number; bytes: number }>();

interface Measurement {
    readonly started: WorkerDiagnostics;
    readonly samples: number[];
    ticks: number;
    total: number;
    min: number;
    max: number;
    enemyMin: number;
    enemyMax: number;
}
let measurement: Measurement | null = null;
let measurementTimer: ReturnType<typeof setTimeout> | null = null;

function send(message: WorldMessage, transfer: ArrayBuffer[] = []): void {
    port?.postMessage(message, transfer);
}

function output(socket: WorkerConnection, event: string, args: unknown[]): void {
    let bytes: number;
    try {
        bytes = dtoBytes(args, MAX_OUTPUT_BYTES_PER_CLIENT);
    } catch {
        socket.disconnect();
        return;
    }
    const pending = clientOutput.get(socket.id) ?? { count: 0, bytes: 0 };
    if (
        pending.count >= MAX_OUTPUT_MESSAGES_PER_CLIENT ||
        pending.bytes + bytes > MAX_OUTPUT_BYTES_PER_CLIENT ||
        totalOutputBytes + bytes > MAX_TOTAL_OUTPUT_BYTES ||
        totalOutputMessages >= MAX_TOTAL_OUTPUT_MESSAGES
    ) {
        // Its replication baseline has advanced. Disconnect instead of dropping a delta.
        socket.disconnect();
        return;
    }
    pending.count++;
    pending.bytes += bytes;
    totalOutputBytes += bytes;
    totalOutputMessages++;
    clientOutput.set(socket.id, pending);
    outputQueue.push({ id: ++nextOutputId, clientId: socket.id, event, args, bytes });
    flushOutput();
}

function transferableBuffers(value: unknown, result = new Set<ArrayBuffer>()): ArrayBuffer[] {
    if (value instanceof ArrayBuffer) result.add(value);
    else if (Array.isArray(value)) for (const item of value) transferableBuffers(item, result);
    else if (value && typeof value === "object" && !ArrayBuffer.isView(value))
        for (const item of Object.values(value)) transferableBuffers(item, result);
    return [...result];
}

function flushOutput(): void {
    while (!stopping && outputQueue.length > 0 && outputsInFlight.size < MAX_OUTPUT_IN_FLIGHT) {
        const next = outputQueue[0];
        if (!next || (outputsInFlight.size > 0 && outputInFlightBytes + next.bytes > MAX_OUTPUT_IN_FLIGHT_BYTES))
            return;
        outputQueue.shift();
        outputsInFlight.set(next.id, next);
        outputInFlightBytes += next.bytes;
        send(
            { type: "output", id: next.id, clientId: next.clientId, event: next.event, args: next.args },
            transferableBuffers(next.args),
        );
    }
}

function releaseOutput(output: Output): void {
    totalOutputBytes -= output.bytes;
    totalOutputMessages--;
    const pending = clientOutput.get(output.clientId);
    if (!pending) return;
    pending.count--;
    pending.bytes -= output.bytes;
    if (pending.count === 0) clientOutput.delete(output.clientId);
}

function discardQueuedOutput(clientId: string): void {
    outputQueue = outputQueue.filter((item) => {
        if (item.clientId !== clientId) return true;
        releaseOutput(item);
        return false;
    });
}

function diagnostics(): WorkerDiagnostics {
    const state = server.getDiagnostics();
    if (!state.performance) throw new Error("Performance world is unavailable");
    return {
        ...state,
        threadId,
        performance: state.performance,
        ...(measurement ? { measurement: { ticks: measurement.ticks, samples: measurement.samples.length } } : {}),
    };
}

function beginMeasurement(): WorkerDiagnostics {
    if (measurement) throw new Error("Worker measurement is already active");
    const started = diagnostics();
    measurement = { started, samples: [], ticks: 0, total: 0, min: Infinity, max: 0, enemyMin: Infinity, enemyMax: 0 };
    measurementTimer = setTimeout(() => {
        measurement = null;
        measurementTimer = null;
    }, MAX_MEASUREMENT_MS);
    return started;
}

function endMeasurement(): WorkerMeasurement {
    const current = measurement;
    if (!current) throw new Error("No worker measurement is active");
    const ended = diagnostics();
    measurement = null;
    if (measurementTimer) clearTimeout(measurementTimer);
    measurementTimer = null;
    return {
        started: current.started,
        ended,
        elapsedMs: ended.at - current.started.at,
        ticks: current.ticks,
        tickCpuMs: current.samples,
        minTickMs: current.ticks ? current.min : 0,
        maxTickMs: current.max,
        averageTickMs: current.ticks ? current.total / current.ticks : 0,
        enemyMin: current.ticks ? current.enemyMin : ended.performance.enemies,
        enemyMax: current.ticks ? current.enemyMax : ended.performance.enemies,
        droppedTimeMs: ended.droppedTimeMs - current.started.droppedTimeMs,
    };
}

const unsubscribeTiming = server.subscribeStepTiming((duration, enemies) => {
    if (!measurement) return;
    measurement.ticks++;
    measurement.total += duration;
    measurement.min = Math.min(measurement.min, duration);
    measurement.max = Math.max(measurement.max, duration);
    measurement.enemyMin = Math.min(measurement.enemyMin, enemies);
    measurement.enemyMax = Math.max(measurement.enemyMax, enemies);
    if (measurement.samples.length < MAX_MEASUREMENT_SAMPLES) measurement.samples.push(duration);
});

function stop(): void {
    if (stopping) return;
    stopping = true;
    if (measurementTimer) clearTimeout(measurementTimer);
    measurementTimer = null;
    measurement = null;
    unsubscribeTiming();
    try {
        server.dispose();
    } finally {
        transport.connections.clear();
        outputQueue = [];
        outputsInFlight.clear();
        clientOutput.clear();
        totalOutputBytes = 0;
        totalOutputMessages = 0;
        send({ type: "stopped" });
        port?.close();
    }
}

function receive(message: HostMessage): void {
    if (message.type === "stop") {
        stop();
        return;
    }
    if (stopping) return;
    switch (message.type) {
        case "delivery":
            for (const command of message.messages) {
                if (command.type === "connect") transport.connect(command);
                else if (command.type === "disconnect") transport.connections.get(command.clientId)?.disconnect();
                else {
                    if (!FORWARDED_EVENTS.has(command.event)) throw new Error("Unknown worker input event");
                    transport.connections.get(command.clientId)?.receive(command.event, command.payload);
                }
            }
            send({ type: "delivered", id: message.id });
            break;
        case "received": {
            const item = outputsInFlight.get(message.id);
            if (!item) throw new Error("Unknown worker output ACK");
            outputsInFlight.delete(message.id);
            outputInFlightBytes -= item.bytes;
            releaseOutput(item);
            flushOutput();
            break;
        }
        case "request":
            try {
                const value =
                    message.action === "inspect"
                        ? diagnostics()
                        : message.action === "beginMeasurement"
                          ? beginMeasurement()
                          : endMeasurement();
                send({ type: "response", id: message.id, value });
            } catch (error) {
                send({
                    type: "response-error",
                    id: message.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            break;
    }
}

port.on("message", receive);
port.on("close", () => {
    if (!stopping) stop();
});
server.start();
send({ type: "ready" });
