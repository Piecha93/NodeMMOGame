import { Worker } from "node:worker_threads";
import { join } from "node:path";
import type { Namespace, Socket } from "socket.io";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { PerformanceEvents } from "../../shared/gameplay/Performance";
import { disabledUserRepository, UserRepository } from "../database/UserRepository";
import {
    dtoBytes,
    HostMessage,
    InboundCommand,
    WorkerDiagnostics,
    WorkerMeasurement,
    WorkerRequestAction,
    WorldMessage,
} from "./protocol";

export type { WorkerDiagnostics, WorkerMeasurement } from "./protocol";

export interface PerformanceWorkerHostOptions {
    readonly userRepository?: Pick<UserRepository, "findUserById">;
    readonly workerFactory?: (filename: string) => Worker;
    readonly startupTimeoutMs?: number;
    readonly shutdownTimeoutMs?: number;
    readonly requestTimeoutMs?: number;
    readonly admissionTimeoutMs?: number;
    readonly maxPendingConnections?: number;
    readonly maxClients?: number;
    readonly maxPendingMessagesPerClient?: number;
    readonly maxPendingBytesPerClient?: number;
}

interface Client {
    readonly id: string;
    readonly socket: Socket;
    readonly listeners: Map<string, (...args: unknown[]) => void>;
    readonly early: Array<{ event: string; payload: unknown; bytes: number }>;
    admissionTimer: ReturnType<typeof setTimeout> | null;
    admitted: boolean;
    closing: boolean;
    pendingCount: number;
    pendingBytes: number;
    transportBytes: number;
    transportMessages: number;
    readonly packetListener: (packet: { data?: unknown }) => void;
    readonly drainListener: () => void;
}
interface DeliveryItem {
    readonly command: InboundCommand;
    readonly bytes: number;
}
interface Request {
    readonly resolve: (value: WorkerDiagnostics | WorkerMeasurement) => void;
    readonly reject: (error: Error) => void;
    readonly timer: ReturnType<typeof setTimeout>;
}

const FORWARDED_EVENTS = [
    SocketMsgs.CLIENT_READY,
    SocketMsgs.INPUT_SNAPSHOT,
    SocketMsgs.HEARTBEAT,
    SocketMsgs.CHAT_MESSAGE,
    PerformanceEvents.CONFIGURE,
];
const MAX_DELIVERY_MESSAGES = 64;
const MAX_TOTAL_PENDING_BYTES = 8 * 1024 * 1024;
const MAX_SOCKET_BUFFER_MESSAGES = 128;
const MAX_SOCKET_BUFFER_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_SOCKET_BUFFER_BYTES = 32 * 1024 * 1024;

/** Owns admission and transport only. The worker exclusively owns the performance world. */
export class PerformanceWorkerHost {
    private worker: Worker | null = null;
    private startPromise: Promise<void> | null = null;
    private disposePromise: Promise<void> | null = null;
    private resolveStart: (() => void) | null = null;
    private rejectStart: ((error: Error) => void) | null = null;
    private resolveStopped: (() => void) | null = null;
    private startupTimer: ReturnType<typeof setTimeout> | null = null;
    private active = false;
    private disposed = false;
    private failed: Error | null = null;
    private listening = false;
    private nextId = 0;
    private pendingAdmissions = 0;
    private pendingBytes = 0;
    private transportPendingBytes = 0;
    private readonly clients = new Map<string, Client>();
    private queue: DeliveryItem[] = [];
    private inFlight: { id: number; items: DeliveryItem[] } | null = null;
    private readonly requests = new Map<number, Request>();
    private readonly connectionListener = (socket: Socket): void => this.admit(socket);
    private readonly messageListener = (message: WorldMessage): void => this.receive(message);
    private readonly errorListener = (error: Error): void => this.fail(error);
    private readonly exitListener = (code: number): void => {
        this.resolveStopped?.();
        if (!this.disposed) this.fail(new Error(`Performance worker exited (${code})`));
    };

    constructor(
        private readonly namespace: Namespace,
        private readonly options: PerformanceWorkerHostOptions = {},
    ) {
        for (const [key, value] of Object.entries(options)) {
            if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 1))
                throw new RangeError(`Invalid worker option ${key}`);
        }
    }

    get running(): boolean {
        return this.active;
    }
    get threadId(): number | null {
        return this.worker && this.worker.threadId >= 0 ? this.worker.threadId : null;
    }

    start(): Promise<void> {
        if (this.disposed) return Promise.reject(new Error("Performance worker host is disposed"));
        if (this.failed) return Promise.reject(this.failed);
        if (this.startPromise) return this.startPromise;
        this.startPromise = new Promise<void>((resolve, reject) => {
            this.resolveStart = resolve;
            this.rejectStart = reject;
        });
        try {
            const filename = join(__dirname, "PerformanceWorker.js");
            this.worker = this.options.workerFactory?.(filename) ?? new Worker(filename);
            this.worker.on("message", this.messageListener);
            this.worker.on("error", this.errorListener);
            this.worker.on("exit", this.exitListener);
            this.startupTimer = setTimeout(
                () => this.fail(new Error("Performance worker startup timed out")),
                this.options.startupTimeoutMs ?? 5000,
            );
        } catch (error) {
            this.fail(this.asError(error));
        }
        return this.startPromise;
    }

    dispose(): Promise<void> {
        if (this.disposePromise) return this.disposePromise;
        this.disposed = true;
        this.active = false;
        this.detachNamespace();
        this.clearStartup();
        const stopped = new Error("Performance worker host disposed");
        this.rejectStart?.(stopped);
        this.resolveStart = null;
        this.rejectStart = null;
        this.rejectRequests(stopped);
        this.closeAll("Performance world stopped");
        this.disposePromise = this.stopWorker();
        return this.disposePromise;
    }

    inspect(): Promise<WorkerDiagnostics> {
        return this.request("inspect") as Promise<WorkerDiagnostics>;
    }
    beginMeasurement(): Promise<WorkerDiagnostics> {
        return this.request("beginMeasurement") as Promise<WorkerDiagnostics>;
    }
    endMeasurement(): Promise<WorkerMeasurement> {
        return this.request("endMeasurement") as Promise<WorkerMeasurement>;
    }

    private async stopWorker(): Promise<void> {
        const worker = this.worker;
        if (!worker) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await new Promise<void>((resolve) => {
                this.resolveStopped = resolve;
                timer = setTimeout(resolve, this.options.shutdownTimeoutMs ?? 2000);
                try {
                    worker.postMessage({ type: "stop" } satisfies HostMessage);
                } catch {
                    resolve();
                }
            });
        } finally {
            if (timer) clearTimeout(timer);
            this.resolveStopped = null;
            try {
                await worker.terminate();
            } finally {
                this.detachWorker(worker);
            }
        }
    }

    private receive(message: WorldMessage): void {
        if (!message || typeof message !== "object") {
            this.fail(new Error("Invalid worker message"));
            return;
        }
        if (message.type === "stopped") {
            this.resolveStopped?.();
            return;
        }
        if (this.disposed || this.failed) return;
        switch (message.type) {
            case "ready":
                if (this.active) {
                    this.fail(new Error("Duplicate worker startup"));
                    return;
                }
                this.clearStartup();
                this.active = true;
                this.namespace.on(SocketMsgs.CONNECTION, this.connectionListener);
                this.listening = true;
                this.resolveStart?.();
                this.resolveStart = null;
                this.rejectStart = null;
                break;
            case "delivered": {
                if (!this.inFlight || this.inFlight.id !== message.id) {
                    this.fail(new Error("Invalid worker delivery ACK"));
                    return;
                }
                const delivery = this.inFlight;
                this.inFlight = null;
                for (const item of delivery.items) {
                    const client = this.clients.get(item.command.clientId);
                    this.release(item, client);
                    if (item.command.type === "disconnect") this.clients.delete(item.command.clientId);
                }
                this.flush();
                break;
            }
            case "output": {
                const client = this.clients.get(message.clientId);
                if (client && !client.closing && client.socket.connected) {
                    try {
                        if (
                            client.transportMessages >= MAX_SOCKET_BUFFER_MESSAGES ||
                            client.transportBytes >= MAX_SOCKET_BUFFER_BYTES
                        )
                            this.closeClient(client, "Slow performance connection", true);
                        else client.socket.emit(message.event, ...message.args);
                    } catch {
                        this.closeClient(client, "Performance transport failed");
                    }
                }
                this.post({ type: "received", id: message.id });
                break;
            }
            case "disconnect": {
                const client = this.clients.get(message.clientId);
                if (client) this.closeClient(client, message.reason ?? "Performance connection closed");
                break;
            }
            case "response":
            case "response-error": {
                const request = this.requests.get(message.id);
                if (!request) return;
                this.requests.delete(message.id);
                clearTimeout(request.timer);
                if (message.type === "response") request.resolve(message.value);
                else request.reject(new Error(message.error));
                break;
            }
            default:
                this.fail(new Error("Unknown worker message"));
        }
    }

    private admit(socket: Socket): void {
        if (!this.active) {
            socket.emit(SocketMsgs.ERROR, "Performance world unavailable");
            socket.disconnect(false);
            return;
        }
        const session = (socket.request as typeof socket.request & { session?: { user_id?: unknown } }).session;
        const userId = session?.user_id;
        if (typeof userId !== "string" || !userId || userId.length > 256) {
            socket.disconnect(false);
            return;
        }
        if (
            this.clients.size >= (this.options.maxClients ?? 128) ||
            this.pendingAdmissions >= (this.options.maxPendingConnections ?? 32)
        ) {
            socket.emit(SocketMsgs.ERROR, "Performance admission is busy");
            socket.disconnect(false);
            return;
        }
        socket.compress(false);
        const client: Client = {
            id: String(++this.nextId),
            socket,
            listeners: new Map(),
            early: [],
            admissionTimer: null,
            admitted: false,
            closing: false,
            pendingCount: 0,
            pendingBytes: 0,
            transportBytes: 0,
            transportMessages: 0,
            packetListener: (packet): void => {
                if (client.closing) return;
                try {
                    client.transportMessages++;
                    const bytes = dtoBytes(packet.data, MAX_SOCKET_BUFFER_BYTES);
                    client.transportBytes += bytes;
                    this.transportPendingBytes += bytes;
                    if (
                        client.transportMessages > MAX_SOCKET_BUFFER_MESSAGES ||
                        client.transportBytes > MAX_SOCKET_BUFFER_BYTES ||
                        this.transportPendingBytes > MAX_TOTAL_SOCKET_BUFFER_BYTES
                    )
                        this.closeClient(client, "Slow performance connection", true);
                } catch {
                    this.closeClient(client, "Performance transport exceeded byte limit", true);
                }
            },
            drainListener: (): void => {
                this.transportPendingBytes -= client.transportBytes;
                client.transportBytes = 0;
                client.transportMessages = 0;
            },
        };
        this.clients.set(client.id, client);
        socket.conn.on("packetCreate", client.packetListener);
        socket.conn.on("drain", client.drainListener);
        // Attach before database lookup: CLIENT_READY can arrive immediately after connection.
        for (const event of FORWARDED_EVENTS) {
            const listener = (payload?: unknown): void => this.forward(client, event, payload);
            client.listeners.set(event, listener);
            socket.on(event, listener);
        }
        const disconnect = (): void => this.closeClient(client);
        client.listeners.set(SocketMsgs.DISCONNECT, disconnect);
        socket.on(SocketMsgs.DISCONNECT, disconnect);
        if (userId.startsWith("Guest")) {
            this.finishAdmission(client, userId);
            return;
        }
        this.pendingAdmissions++;
        client.admissionTimer = setTimeout(
            () => this.closeClient(client, "Account lookup timed out"),
            this.options.admissionTimeoutMs ?? 5000,
        );
        const repository = this.options.userRepository ?? disabledUserRepository;
        void Promise.resolve()
            .then(() => repository.findUserById(userId))
            .then((user) => {
                if (!client.closing && socket.connected && this.active)
                    this.finishAdmission(client, userId, user?.username ?? "User");
            })
            .catch(() => this.closeClient(client, "Unable to load account"))
            .finally(() => {
                this.pendingAdmissions--;
            });
    }

    private finishAdmission(client: Client, userId: string, displayName?: string): void {
        this.clearAdmission(client);
        if (client.closing || !client.socket.connected || !this.active) return;
        client.admitted = true;
        const safeName = displayName
            ?.normalize("NFKC")
            .replace(/[^\p{L}\p{N} _-]/gu, "")
            .replace(/\s+/g, " ")
            .trim();
        this.enqueue(
            {
                type: "connect",
                clientId: client.id,
                userId,
                ...(displayName !== undefined
                    ? {
                          displayName:
                              Array.from(safeName ?? "")
                                  .slice(0, 32)
                                  .join("") || "User",
                      }
                    : {}),
            },
            0,
        );
        for (const event of client.early.splice(0))
            this.enqueue(
                { type: "event", clientId: client.id, event: event.event, payload: event.payload },
                event.bytes,
                false,
            );
        this.flush();
    }

    private forward(client: Client, event: string, payload: unknown): void {
        if (client.closing || !this.active) return;
        let bytes: number;
        try {
            bytes = dtoBytes(payload);
        } catch {
            this.closeClient(client, "Malformed performance event");
            return;
        }
        if (
            client.pendingCount >= (this.options.maxPendingMessagesPerClient ?? 256) ||
            client.pendingBytes + bytes > (this.options.maxPendingBytesPerClient ?? 512 * 1024) ||
            this.pendingBytes + bytes > MAX_TOTAL_PENDING_BYTES
        ) {
            this.closeClient(client, "Performance input backlog exceeded");
            return;
        }
        client.pendingCount++;
        client.pendingBytes += bytes;
        this.pendingBytes += bytes;
        if (!client.admitted) client.early.push({ event, payload, bytes });
        else this.enqueue({ type: "event", clientId: client.id, event, payload }, bytes, false);
        this.flush();
    }

    private enqueue(command: InboundCommand, bytes: number, flush = true): void {
        this.queue.push({ command, bytes });
        if (flush) this.flush();
    }

    private flush(): void {
        if (!this.active || this.inFlight || this.queue.length === 0) return;
        const items = this.queue.splice(0, MAX_DELIVERY_MESSAGES);
        const id = ++this.nextId;
        this.inFlight = { id, items };
        this.post({ type: "delivery", id, messages: items.map((item) => item.command) });
    }

    private closeClient(client: Client, reason?: string, closeTransport = false): void {
        if (client.closing) return;
        client.closing = true;
        this.clearAdmission(client);
        for (const [event, listener] of client.listeners) client.socket.off(event, listener);
        client.listeners.clear();
        client.socket.conn.off("packetCreate", client.packetListener);
        client.socket.conn.off("drain", client.drainListener);
        this.transportPendingBytes -= client.transportBytes;
        client.transportBytes = 0;
        client.transportMessages = 0;
        for (const event of client.early.splice(0)) {
            this.pendingBytes -= event.bytes;
            client.pendingBytes -= event.bytes;
            client.pendingCount--;
        }
        this.queue = this.queue.filter((item) => {
            if (item.command.clientId !== client.id || item.command.type !== "event") return true;
            this.release(item, client);
            return false;
        });
        if (client.socket.connected) {
            if (reason) client.socket.emit(SocketMsgs.ERROR, reason);
            // Disconnect this namespace; the ordinary world can share its Engine.IO connection.
            client.socket.disconnect(closeTransport);
        }
        if (client.admitted && this.active) this.enqueue({ type: "disconnect", clientId: client.id }, 0);
        else this.clients.delete(client.id);
    }

    private release(item: DeliveryItem, client: Client | undefined): void {
        if (item.command.type !== "event") return;
        this.pendingBytes -= item.bytes;
        if (client) {
            client.pendingBytes -= item.bytes;
            client.pendingCount--;
        }
    }

    private clearAdmission(client: Client): void {
        if (client.admissionTimer === null) return;
        clearTimeout(client.admissionTimer);
        client.admissionTimer = null;
    }

    private request(action: WorkerRequestAction): Promise<WorkerDiagnostics | WorkerMeasurement> {
        if (!this.active || this.disposed || this.failed)
            return Promise.reject(this.failed ?? new Error("Performance worker is not running"));
        if (this.requests.size >= 16) return Promise.reject(new Error("Too many worker diagnostic requests"));
        return new Promise((resolve, reject) => {
            const id = ++this.nextId;
            // Keep timed-out requests counted until their response or worker disposal.
            // Otherwise repeated timeouts could queue unlimited RPCs in a stalled worker.
            const timer = setTimeout(() => {
                reject(new Error("Performance worker request timed out"));
            }, this.options.requestTimeoutMs ?? 5000);
            this.requests.set(id, { resolve, reject, timer });
            this.post({ type: "request", id, action });
        });
    }

    private post(message: HostMessage): void {
        try {
            this.worker?.postMessage(message);
        } catch (error) {
            this.fail(this.asError(error));
        }
    }

    private fail(error: Error): void {
        if (this.failed || this.disposed) return;
        this.failed = error;
        this.active = false;
        this.clearStartup();
        // Keep the existing admission listener in rejection mode until disposal.
        // A failed world must not leave freshly authenticated sockets hanging.
        this.rejectStart?.(error);
        this.resolveStart = null;
        this.rejectStart = null;
        this.rejectRequests(error);
        this.closeAll("Performance world unavailable");
        const worker = this.worker;
        if (worker)
            void worker
                .terminate()
                .catch(() => {})
                .finally(() => this.detachWorker(worker));
    }

    private closeAll(reason: string): void {
        for (const client of this.clients.values()) this.closeClient(client, reason);
        this.clients.clear();
        this.queue = [];
        this.inFlight = null;
        this.pendingBytes = 0;
    }
    private rejectRequests(error: Error): void {
        for (const request of this.requests.values()) {
            clearTimeout(request.timer);
            request.reject(error);
        }
        this.requests.clear();
    }
    private detachNamespace(): void {
        if (this.listening) this.namespace.off(SocketMsgs.CONNECTION, this.connectionListener);
        this.listening = false;
    }
    private clearStartup(): void {
        if (this.startupTimer) clearTimeout(this.startupTimer);
        this.startupTimer = null;
    }
    private detachWorker(worker: Worker): void {
        worker.off("message", this.messageListener);
        worker.off("error", this.errorListener);
        worker.off("exit", this.exitListener);
        if (this.worker === worker) this.worker = null;
    }
    private asError(error: unknown): Error {
        return error instanceof Error ? error : new Error(String(error));
    }
}
