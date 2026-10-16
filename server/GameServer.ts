import { WorldOptions } from "../shared/core/WorldContext";
import { InputCommand, validateInputCommand, isNewerSequence, encodeSnapshot } from "../shared/protocol";
import { commandToSnapshot } from "../shared/replication/InputCommandAdapter";
import { ReplicationSession } from "../shared/replication/ReplicationSession";
import { Server, Socket, Namespace } from "socket.io";

import { ServerClient } from "./ServerClient";
import { Player } from "../shared/game_utils/game/objects/Player";
import { InputSnapshot, InvalidInputSnapshotError } from "../shared/input/InputSnapshot";
import { GameObject } from "../shared/game_utils/game/objects/GameObject";
import { ServerConfig } from "./ServerConfig";
import { SocketMsgs } from "../shared/net/SocketMsgs";
import { disabledUserRepository, UserRepository } from "./database/UserRepository";
import { Chunk } from "../shared/chunks/Chunk";
import { Origin, SharedConfig } from "../shared/SharedConfig";
import { ObjectsSerializer } from "../shared/serialize/ObjectsSerializer";
import { GameCore } from "../shared/GameCore";
import { MagicWand } from "../shared/game_utils/game/weapons/MagicWand";
import { ObjectsSpawner } from "../shared/game_utils/game/weapons/ObjectsSpawner";
import { ClientsInputSnapshotHandler } from "./ClientsInputSnapshotHandler";

import { negotiateProtocolVersion } from "../shared/net/Protocol";
import { ExpeditionController } from "./runtime/ExpeditionController";
import { EXPEDITION, ExpeditionEvents } from "../shared/gameplay/Expedition";
import { PerformanceEvents } from "../shared/gameplay/Performance";
import { PerformanceController } from "./runtime/PerformanceController";

export interface GameServerOptions {
    readonly userRepository?: Pick<UserRepository, "findUserById">;
    readonly world?: WorldOptions;
    readonly seedWorld?: (core: GameCore) => void;
    readonly expedition?: boolean;
    readonly performance?: boolean;
}

export class GameServer {
    private readonly v2Clients = new Map<
        ServerClient,
        {
            queue: InputCommand[];
            lastReceived: number | null;
            lastProcessed: number | null;
            replication: ReplicationSession;
        }
    >();
    private sockets: Server | Namespace;

    private clients: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();
    private userIdToSocketMap: Map<string, Socket> = new Map<string, Socket>();

    private core: GameCore;
    private expedition: ExpeditionController | null = null;
    private performance: PerformanceController | null = null;
    private readonly snapshotTraffic = new Map<ServerClient, { startedAt: number; bytes: number; rate: number }>();
    private lastPerformanceBroadcast = -Infinity;
    private lastPerformanceConfiguration = -Infinity;
    private nextTraveler = 1;
    private lastExpeditionBroadcast = -Infinity;

    private lastChunkSent: Map<string, Chunk> = new Map<string, Chunk>(); //TODO move this somewhere else
    private clientsInputSnapshotHandler: ClientsInputSnapshotHandler;
    private lastDisconnectCheck: number = 0;
    private running = false;
    private disposed = false;
    private coreDisposed = false;
    private socketsConfigured = false;
    private gameTimer: ReturnType<typeof setTimeout> | null = null;
    private updateTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly connectionHandler = (socket: Socket) => this.onConnection(socket);
    private readonly userRepository: Pick<UserRepository, "findUserById">;

    constructor(
        sockets: Server | Namespace,
        private readonly options: GameServerOptions = {},
    ) {
        if (options.performance && options.expedition)
            throw new Error("Performance tests require a separate game world");
        this.sockets = sockets;
        this.userRepository = options.userRepository ?? disabledUserRepository;
        this.core = this.createCore();
        this.clientsInputSnapshotHandler = new ClientsInputSnapshotHandler(this.core.ObjectsManager);
    }

    private createCore(): GameCore {
        const core = new GameCore({
            enableDebugActions: ServerConfig.ENABLE_DEBUG_COMMANDS,
            ...this.options.world,
            role: Origin.SERVER,
            ...(this.options.expedition ? { cooperative: true } : {}),
            ...(this.options.performance
                ? { performanceMode: true, cooperative: true, enableDebugActions: false }
                : {}),
        });
        this.expedition = this.options.expedition ? new ExpeditionController(core) : null;
        this.performance = this.options.performance ? new PerformanceController(core) : null;
        core.subscribeBeforeStep((_tick, delta) => {
            this.expedition?.update(delta);
            this.processInputCommands();
        });
        return core;
    }

    private processInputCommands(): void {
        const phase = this.expedition?.state().phase;
        const playable = phase === undefined || phase === "active";
        for (const [client, state] of this.v2Clients) {
            const player = this.getReadyPlayer(client);
            if (!player) continue;
            // A stress test can deliberately exceed the simulation budget. Apply
            // the latest held movement and ACK the consumed queue in one tick,
            // retaining queued actions under the normal action rate limit.
            const commands = this.performance ? state.queue.splice(0) : undefined;
            const command = commands ? commands.at(-1) : state.queue.shift();
            if (!command) {
                player.setInput(new InputSnapshot("0=2:0#5:0"));
                continue;
            }
            if (!playable || player.HP <= 0) {
                player.setInput(new InputSnapshot("0=2:0#5:0"));
                state.lastProcessed = command.seq;
                continue;
            }
            player.setInput(commandToSnapshot(command, false));
            const actions = commands ? commands.flatMap((pending) => pending.actions ?? []) : (command.actions ?? []);
            for (const action of actions) {
                if (
                    !client.allowEvent("action-v2", ServerConfig.MAX_ACTIONS_PER_WINDOW, ServerConfig.RATE_LIMIT_WINDOW)
                ) {
                    continue;
                }
                if (action.kind === "interact") {
                    const target = this.core.ObjectsManager.get(action.targetId);
                    if (target && player.Transform.distanceTo(target.Transform) < 75) target.interact();
                } else player.setInput(commandToSnapshot({ ...command, actions: [action] }));
            }
            state.lastProcessed = command.seq;
        }
    }

    private sendV2Snapshot(client: ServerClient, first = false): void {
        const player = this.getReadyPlayer(client);
        const state = this.v2Clients.get(client);
        if (!player || !state) return;
        const prepared = state.replication.prepare(this.core, player, state.lastProcessed);
        const frames = encodeSnapshot(prepared.snapshot);
        if (this.performance) {
            const traffic = this.snapshotTraffic.get(client) ?? { startedAt: Date.now(), bytes: 0, rate: 0 };
            traffic.bytes += frames.reduce((bytes, frame) => bytes + frame.byteLength, 0);
            this.snapshotTraffic.set(client, traffic);
        }
        prepared.commit();
        client.Socket.emit(first ? SocketMsgs.FIRST_UPDATE_GAME : SocketMsgs.UPDATE_GAME, frames);
    }

    public start() {
        if (this.disposed) {
            throw new Error("Game server is disposed");
        }
        if (this.running) {
            return;
        }
        if (this.coreDisposed) {
            this.core = this.createCore();
            this.clientsInputSnapshotHandler = new ClientsInputSnapshotHandler(this.core.ObjectsManager);
            this.coreDisposed = false;
        }

        this.running = true;
        try {
            this.configureSockets();
            this.startGame();
        } catch (error) {
            this.stop();
            throw error;
        }
    }

    public stop(): void {
        this.running = false;
        if (this.gameTimer !== null) {
            clearTimeout(this.gameTimer);
            this.gameTimer = null;
        }
        if (this.updateTimer !== null) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (this.socketsConfigured) {
            this.sockets.off(SocketMsgs.CONNECTION, this.connectionHandler);
            this.socketsConfigured = false;
        }

        const errors: unknown[] = [];
        for (const client of Array.from(this.clients.values())) {
            try {
                this.clientDisconnected(client, "Server stopped");
            } catch (error) {
                errors.push(error);
            }
        }
        this.clients.clear();
        this.v2Clients.clear();
        this.userIdToSocketMap.clear();
        this.lastChunkSent.clear();
        this.expedition?.dispose();
        this.expedition = null;
        this.performance?.dispose();
        this.performance = null;
        this.snapshotTraffic.clear();
        this.lastPerformanceBroadcast = -Infinity;
        this.lastPerformanceConfiguration = -Infinity;
        this.lastExpeditionBroadcast = -Infinity;
        if (!this.coreDisposed) {
            this.coreDisposed = true;
            try {
                this.core.dispose();
            } catch (error) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, "Game server cleanup failed");
        }
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.stop();
    }

    private startGame() {
        this.expedition?.start();
        this.options.seedWorld?.(this.core);

        this.startGameLoop();
        this.startUpdateLoop();
    }

    private startGameLoop() {
        if (!this.running) {
            return;
        }
        this.core.gameLoop();
        this.checkDisconnectInterval();

        this.gameTimer = setTimeout(() => {
            this.startGameLoop();
        }, ServerConfig.TICKRATE);
    }

    private startUpdateLoop() {
        if (!this.running) {
            return;
        }
        this.updateTimer = setTimeout(() => {
            this.collectAndSendUpdate();
            this.startUpdateLoop();
        }, ServerConfig.UPDATE_INTERVAL);
    }

    private checkDisconnectInterval() {
        let now: number = Date.now();
        if (now - this.lastDisconnectCheck < ServerConfig.DISCONNECT_CHECK_INTERVAL) {
            return;
        }

        this.lastDisconnectCheck = now;
        let expiredTime: number = now - ServerConfig.CLIENT_TIMEOUT_TIME;
        Array.from(this.clients.values()).forEach((client: ServerClient) => {
            if (client.LastHbTime <= expiredTime) {
                this.clientDisconnected(client, "timeout");
            }
        });
    }

    private configureSockets() {
        if (!this.socketsConfigured) {
            this.sockets.on(SocketMsgs.CONNECTION, this.connectionHandler);
            this.socketsConfigured = true;
        }
    }

    private onConnection(socket: Socket) {
        socket.compress(false);
        // use to fake latency
        // (function() {
        //     let oldEmit = socket.emit;
        //     let fff: any = function() {
        //         let args = Array.from(arguments);
        //         setTimeout(() => {
        //             oldEmit.apply(this, args);
        //         }, 300);
        //     };
        //     socket.emit = fff;
        // })();

        const socketSession = (
            socket.request as typeof socket.request & {
                session?: { user_id?: string };
            }
        ).session;
        const userId = socketSession?.user_id;

        if (!userId) {
            socket.emit(SocketMsgs.ERROR, "Missing authenticated session");
            socket.disconnect(true);
            return;
        }

        const previousSocket = this.userIdToSocketMap.get(userId);
        if (previousSocket && previousSocket !== socket) {
            const previousClient = this.clients.get(previousSocket);
            if (previousClient) {
                this.clientDisconnected(previousClient, "You have connected from another browser");
            } else {
                this.userIdToSocketMap.delete(userId);
                previousSocket.disconnect(true);
            }
        }

        let serverClient: ServerClient = new ServerClient(socket, userId);
        this.clients.set(socket, serverClient);
        this.userIdToSocketMap.set(userId, socket);

        if (userId.startsWith("Guest")) {
            serverClient.Name = this.expedition
                ? `Wędrowiec ${this.nextTraveler++}`
                : this.performance
                  ? `Tester ${this.nextTraveler++}`
                  : userId;
        } else {
            serverClient.Name = "User";
            void this.userRepository
                .findUserById(userId)
                .then((user) => {
                    if (!user || !this.isConnectedClient(serverClient)) {
                        return;
                    }
                    serverClient.Name = this.sanitizePlayerName(user.username);
                    let player: Player = this.core.ObjectsManager.get(serverClient.PlayerId) as Player;
                    if (player) {
                        player.Name = serverClient.Name;
                    }
                })
                .catch((error) => console.error("Unable to load user:", error));
        }

        socket.on(SocketMsgs.CLIENT_READY, (protocolOffer?: unknown) => {
            if (!this.isConnectedClient(serverClient) || serverClient.IsReady) {
                return;
            }

            const protocolNegotiation = negotiateProtocolVersion(protocolOffer);
            if (protocolNegotiation.ok === false) {
                const reason =
                    protocolNegotiation.reason === "malformed"
                        ? "Malformed protocol negotiation"
                        : "Unsupported protocol version";
                this.clientDisconnected(serverClient, reason);
                return;
            }

            serverClient.ProtocolVersion = protocolNegotiation.version;
            if ((this.expedition || this.performance) && serverClient.ProtocolVersion !== 2) {
                this.clientDisconnected(serverClient, "Wyprawa wymaga aktualnego klienta. Odśwież stronę.");
                return;
            }
            const readyPlayers = Array.from(this.clients.values()).filter((client) => client.IsReady).length;
            if (this.expedition && readyPlayers >= EXPEDITION.maxPlayers) {
                this.clientDisconnected(serverClient, "Drużyna jest pełna (4 graczy).");
                return;
            }

            try {
                const position =
                    this.expedition?.spawnPosition(readyPlayers) ??
                    this.performance?.spawnPosition() ??
                    ([
                        this.getRandomInsideMap(this.core.Runtime.config.numOfChunksX),
                        this.getRandomInsideMap(this.core.Runtime.config.numOfChunksY),
                    ] as [number, number]);
                const player = this.core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", position) as Player;

                serverClient.PlayerId = player.ID;
                player.Name = serverClient.Name;
                serverClient.IsReady = true;
                this.expedition?.join(player);

                socket.emit(SocketMsgs.INITIALIZE_GAME, {
                    id: player.ID,
                    protocolVersion: serverClient.ProtocolVersion,
                    fixedDeltaMs: this.core.Runtime.config.fixedDeltaMs,
                });

                if (serverClient.ProtocolVersion === 2) {
                    this.v2Clients.set(serverClient, {
                        queue: [],
                        lastReceived: null,
                        lastProcessed: null,
                        replication: new ReplicationSession(),
                    });
                    this.sendV2Snapshot(serverClient, true);
                } else socket.emit(SocketMsgs.FIRST_UPDATE_GAME, [ObjectsSerializer.serializeObject(player)]);
                if (this.expedition) this.broadcastExpeditionState(true);
                if (this.performance) this.broadcastPerformanceState(true);

                this.sockets.emit(SocketMsgs.CHAT_MESSAGE, { s: "Server", m: player.Name + " has joined game" });
            } catch (error) {
                console.error("Cannot encode initial game state", error);
                this.clientDisconnected(serverClient, "State synchronization failed");
            }
        });

        socket.on(PerformanceEvents.CONFIGURE, (configuration: unknown) => {
            const player = this.getReadyPlayer(serverClient);
            if (
                !this.performance ||
                !player ||
                serverClient.ProtocolVersion !== 2 ||
                !serverClient.allowEvent("performance-setup", 1, 1000)
            )
                return;
            const now = Date.now();
            if (now - this.lastPerformanceConfiguration < 1000) return;
            try {
                this.performance.configure(configuration, player.Transform.Position);
                this.lastPerformanceConfiguration = now;
                this.broadcastPerformanceState(true);
            } catch {
                // Invalid or oversized test requests never allocate a population.
                this.broadcastPerformanceState(true);
            }
        });

        socket.on(ExpeditionEvents.RESTART, () => {
            if (
                !this.expedition ||
                !this.getReadyPlayer(serverClient) ||
                !serverClient.allowEvent("restart-expedition", 2, 1000)
            )
                return;
            if (this.expedition.restart()) {
                for (const state of this.v2Clients.values()) state.queue.length = 0;
                this.broadcastExpeditionState(true);
            }
        });

        socket.on(SocketMsgs.INPUT_SNAPSHOT, (snapshotData: unknown) => {
            if (serverClient.ProtocolVersion === 2 && this.isConnectedClient(serverClient)) {
                const state = this.v2Clients.get(serverClient);
                if (!state || !this.getReadyPlayer(serverClient)) return;
                try {
                    if (
                        !serverClient.allowEvent("input-v2", 128, ServerConfig.RATE_LIMIT_WINDOW) ||
                        state.queue.length >= 256
                    ) {
                        this.clientDisconnected(serverClient, "Input backlog exceeded");
                        return;
                    }
                    const command = validateInputCommand(snapshotData);
                    if (state.lastReceived !== null && !isNewerSequence(command.seq, state.lastReceived)) return;
                    state.lastReceived = command.seq;
                    state.queue.push(command);
                } catch {
                    this.clientDisconnected(serverClient, "Malformed v2 input");
                }
                return;
            }
            if (
                !this.isConnectedClient(serverClient) ||
                !serverClient.allowEvent(
                    "input",
                    ServerConfig.MAX_INPUT_SNAPSHOTS_PER_WINDOW,
                    ServerConfig.RATE_LIMIT_WINDOW,
                ) ||
                typeof snapshotData !== "string" ||
                snapshotData.length > InputSnapshot.MAX_SERIALIZED_LENGTH
            ) {
                return;
            }

            const player = this.getReadyPlayer(serverClient);
            if (!player) {
                return;
            }

            try {
                this.clientsInputSnapshotHandler.setSnapshot(player, snapshotData);
            } catch (error) {
                if (!(error instanceof InvalidInputSnapshotError)) {
                    console.error("Unable to process input snapshot:", error);
                }
            }
        });

        socket.on(SocketMsgs.HEARTBEAT, (data: unknown) => {
            if (
                this.isConnectedClient(serverClient) &&
                serverClient.allowEvent(
                    "heartbeat",
                    ServerConfig.MAX_HEARTBEATS_PER_WINDOW,
                    ServerConfig.RATE_LIMIT_WINDOW,
                ) &&
                typeof data === "number" &&
                Number.isSafeInteger(data)
            ) {
                serverClient.LastHbTime = Date.now();
                socket.emit(SocketMsgs.HEARTBEAT_RESPONSE, data);
            }
        });

        socket.on(SocketMsgs.CHAT_MESSAGE, (msg: unknown) => {
            if (
                !this.isConnectedClient(serverClient) ||
                !serverClient.allowEvent(
                    "chat",
                    ServerConfig.MAX_CHAT_MESSAGES_PER_WINDOW,
                    ServerConfig.RATE_LIMIT_WINDOW,
                ) ||
                typeof msg !== "string" ||
                msg.length > ServerConfig.MAX_CHAT_MESSAGE_LENGTH
            ) {
                return;
            }

            const chatMessage = msg.trim();
            if (!chatMessage) {
                return;
            }

            if (chatMessage === "fire" || chatMessage === "spawner") {
                const player = this.getReadyPlayer(serverClient);
                if (!this.core.Runtime.config.enableDebugActions || !player) {
                    return;
                }

                player.Weapon = chatMessage === "fire" ? new MagicWand() : new ObjectsSpawner();
                return;
            }

            this.sockets.emit(SocketMsgs.CHAT_MESSAGE, { s: serverClient.Name, m: chatMessage });
        });

        socket.on(SocketMsgs.DISCONNECT, () => {
            this.clientDisconnected(this.clients.get(socket), "disconnected");
        });
    }

    private sendUpdate(chunksUpdate: Map<Chunk, ArrayBuffer | ArrayBuffer[]>) {
        this.clients.forEach((client: ServerClient) => {
            if (client.ProtocolVersion === 2) {
                try {
                    this.sendV2Snapshot(client);
                } catch (error) {
                    console.error("Cannot encode v2 update", error);
                    this.clientDisconnected(client, "State synchronization failed");
                }
                return;
            }
            if (this.isConnectedClient(client) && client.IsReady) {
                const player = this.getReadyPlayer(client);
                if (!player) {
                    return;
                }

                const chunk = this.core.ChunksManager.getObjectChunk(player);
                if (!chunk) {
                    return;
                }

                let updateArray: Array<ArrayBuffer> = [];
                if (chunksUpdate.has(chunk)) {
                    const frame = chunksUpdate.get(chunk);
                    if (frame) updateArray.push(...(Array.isArray(frame) ? frame : [frame]));
                }

                chunk.Neighbors.forEach((chunkNeighbor: Chunk) => {
                    if (chunksUpdate.has(chunkNeighbor)) {
                        const frame = chunksUpdate.get(chunkNeighbor);
                        if (frame) updateArray.push(...(Array.isArray(frame) ? frame : [frame]));
                    }
                });

                const snapshot = this.clientsInputSnapshotHandler.getPlayerLastSnapshot(player);
                if (snapshot) {
                    client.Socket.emit(SocketMsgs.UPDATE_SNAPSHOT_DATA, [snapshot.ID, snapshot.SnapshotDelta]);
                }

                if (this.lastChunkSent.get(client.PlayerId) != chunk) {
                    client.Socket.emit(SocketMsgs.CHUNK_CHANGED, chunk.Position);
                    this.lastChunkSent.set(client.PlayerId, chunk);
                }

                if (updateArray.length > 0) {
                    client.Socket.emit(SocketMsgs.UPDATE_GAME, updateArray);
                }
            }
        });
    }

    private collectAndSendUpdate() {
        this.sendUpdate(this.core.collectUpdateFrames());
        this.broadcastExpeditionState();
        this.broadcastPerformanceState();
    }

    private broadcastPerformanceState(force = false): void {
        const now = Date.now();
        if (!this.performance || (!force && now - this.lastPerformanceBroadcast < 250)) return;
        this.lastPerformanceBroadcast = now;
        for (const client of this.clients.values()) {
            if (!client.IsReady || client.ProtocolVersion !== 2) continue;
            const traffic = this.snapshotTraffic.get(client);
            if (traffic && now - traffic.startedAt >= 1000) {
                traffic.rate = traffic.bytes / ((now - traffic.startedAt) / 1000);
                traffic.bytes = 0;
                traffic.startedAt = now;
            }
            client.Socket.emit(PerformanceEvents.STATE, this.performance.state(traffic?.rate ?? 0));
        }
    }

    private broadcastExpeditionState(force = false): void {
        if (!this.expedition || (!force && this.core.Runtime.timeMs - this.lastExpeditionBroadcast < 200)) return;
        this.lastExpeditionBroadcast = this.core.Runtime.timeMs;
        const state = this.expedition.state();
        for (const client of this.clients.values()) {
            if (client.IsReady && client.ProtocolVersion === 2) client.Socket.emit(ExpeditionEvents.STATE, state);
        }
    }

    private clientDisconnected(client: ServerClient | undefined, reason?: string) {
        if (!client || client.IsDisconnected) {
            return;
        }

        client.IsDisconnected = true;
        const socket = client.Socket;
        const playerId = client.PlayerId;
        const wasReady = client.IsReady;

        this.clients.delete(socket);
        this.v2Clients.delete(client);
        this.snapshotTraffic.delete(client);
        if (this.performance && this.clients.size === 0) {
            this.performance.configure({ count: 0, distribution: "nearby", scenario: "moving" });
            this.lastPerformanceConfiguration = -Infinity;
        }
        if (this.userIdToSocketMap.get(client.UserId) === socket) {
            this.userIdToSocketMap.delete(client.UserId);
        }
        if (playerId) {
            this.lastChunkSent.delete(playerId);
        }
        try {
            if (playerId) {
                this.expedition?.leave(playerId);
                this.core.ObjectsManager.destroy(playerId);
            }
        } finally {
            client.IsReady = false;
            client.ProtocolVersion = null;
            client.PlayerId = "";

            try {
                if (reason && socket.connected) {
                    socket.emit(SocketMsgs.ERROR, reason);
                }
                if (wasReady) {
                    this.sockets.emit(SocketMsgs.CHAT_MESSAGE, { s: "Server", m: client.Name + " has left game" });
                }
            } finally {
                if (socket.connected) {
                    socket.disconnect(true);
                }
            }
        }
    }

    private isConnectedClient(client: ServerClient): boolean {
        return !client.IsDisconnected && this.clients.get(client.Socket) === client;
    }

    private getReadyPlayer(client: ServerClient): Player | null {
        if (!this.isConnectedClient(client) || !client.IsReady || !client.PlayerId) {
            return null;
        }

        return (this.core.ObjectsManager.get(client.PlayerId) as Player) || null;
    }

    private sanitizePlayerName(name: unknown): string {
        if (typeof name !== "string") {
            return "User";
        }

        const normalizedName = name
            .normalize("NFKC")
            .replace(/[^\p{L}\p{N} _-]/gu, "")
            .replace(/\s+/g, " ")
            .trim();
        const safeName = Array.from(normalizedName).slice(0, 32).join("");

        return safeName || "User";
    }

    private getRandomInsideMap(numberOfChunks: number): number {
        return (
            Math.round(
                (Math.floor(this.core.Runtime.random() * (numberOfChunks * this.core.Runtime.config.chunkSize - 100)) +
                    50) /
                    32,
            ) * 32
        );
    }
}
