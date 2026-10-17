import { WorldOptions } from "../shared/core/WorldContext";
import {
    InputCommand,
    validateInputCommand,
    isNewerSequence,
    encodeSnapshot,
    encodeSnapshotV3,
    EntityState,
} from "../shared/protocol";
import { commandToSnapshot } from "../shared/replication/InputCommandAdapter";
import { simulateMovement } from "../shared/core/SimulateMovement";
import { ReplicationSession, VIEWPORT_INTEREST } from "../shared/replication/ReplicationSession";
import type { GameConnection, GameTransport } from "./transport/GameTransport";

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

import { negotiateProtocolVersion, isSnapshotProtocol } from "../shared/net/Protocol";
import { ExpeditionController } from "./runtime/ExpeditionController";
import { EXPEDITION, ExpeditionEvents } from "../shared/gameplay/Expedition";
import { PerformanceEvents, PerformanceState } from "../shared/gameplay/Performance";
import { PerformanceController } from "./runtime/PerformanceController";
import { InputMovementBudget } from "./runtime/InputMovementBudget";
import { PerformanceMetrics } from "./runtime/PerformanceMetrics";
import { LoopSchedule } from "./runtime/LoopSchedule";
import { AdventureController } from "./runtime/AdventureController";
import { AdventureEvents, WEAPONS } from "../shared/gameplay/Adventure";

export interface GameServerOptions {
    readonly userRepository?: Pick<UserRepository, "findUserById">;
    readonly world?: WorldOptions;
    readonly seedWorld?: (core: GameCore) => void;
    readonly expedition?: boolean;
    readonly performance?: boolean;
}

export interface GameServerDiagnostics {
    readonly serverTick: number;
    readonly at: number;
    readonly droppedTimeMs: number;
    readonly performance: PerformanceState | null;
    readonly clients: number;
    readonly gameTimerActive: boolean;
    readonly updateTimerActive: boolean;
}

export class GameServer {
    private readonly snapshotClients = new Map<
        ServerClient,
        {
            queue: InputCommand[];
            lastReceived: number | null;
            lastProcessed: number | null;
            replication: ReplicationSession;
            movementBudget: InputMovementBudget;
        }
    >();
    private sockets: GameTransport;

    private clients: Map<GameConnection, ServerClient> = new Map<GameConnection, ServerClient>();
    private userIdToSocketMap: Map<string, GameConnection> = new Map<string, GameConnection>();

    private core: GameCore;
    private expedition: ExpeditionController | null = null;
    private adventure: AdventureController | null = null;
    private performance: PerformanceController | null = null;
    private performanceMetrics: PerformanceMetrics | null = null;
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
    private readonly gameSchedule = new LoopSchedule(ServerConfig.TICKRATE);
    private readonly updateSchedule = new LoopSchedule(ServerConfig.UPDATE_INTERVAL);
    private readonly connectionHandler = (socket: GameConnection) => this.onConnection(socket);
    private readonly userRepository: Pick<UserRepository, "findUserById">;

    constructor(
        sockets: GameTransport,
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
                ? {
                      performanceMode: true,
                      cooperative: true,
                      enableDebugActions: false,
                      // The dedicated worker can execute the core's normal bounded
                      // catch-up after loading/snapshot bursts without blocking HTTP.
                      maxCatchUpSteps: this.options.world?.maxCatchUpSteps ?? 8,
                  }
                : {}),
        });
        this.expedition = this.options.expedition ? new ExpeditionController(core) : null;
        this.adventure = this.options.expedition ? new AdventureController(core) : null;
        this.performance = this.options.performance ? new PerformanceController(core) : null;
        this.performanceMetrics = this.options.performance
            ? new PerformanceMetrics(performance.now(), core.Runtime.tick)
            : null;
        core.subscribeBeforeStep((_tick, delta) => {
            this.expedition?.update(delta);
            this.adventure?.update(delta, this.expedition?.state().phase === "active");
            this.processInputCommands();
        });
        return core;
    }

    private processInputCommands(): void {
        const phase = this.expedition?.state().phase;
        const playable = phase === undefined || phase === "active";
        for (const [client, state] of this.snapshotClients) {
            const player = this.getReadyPlayer(client);
            if (!player) continue;
            // An overloaded world may receive several client ticks before its
            // next update. Every ACKed command must still advance player movement
            // once; discarding their time makes reconciliation rewind the player.
            // Upcoming catch-up ticks can consume their own commands normally.
            // Replaying those commands now would repeat global collision work
            // and leave later ticks with an artificial STOP input.
            const reserved = Math.max(0, this.core.PendingSimulationSteps - 1);
            const available = Math.min(state.queue.length, Math.max(1, state.queue.length - reserved));
            const count = this.performance
                ? state.movementBudget.take(available, this.options.world?.clock?.() ?? performance.now())
                : Math.min(1, state.queue.length);
            const commands = state.queue.splice(0, count);
            if (commands.length === 0) {
                player.setInput(new InputSnapshot("0=2:0#5:0"));
                continue;
            }
            for (const [index, command] of commands.entries()) {
                if (!playable || player.HP <= 0) {
                    player.setInput(new InputSnapshot("0=2:0#5:0"));
                    state.lastProcessed = command.seq;
                    continue;
                }
                player.setInput(commandToSnapshot(command, false));
                for (const action of command.actions ?? []) {
                    if (
                        !client.allowEvent(
                            "action-v2",
                            ServerConfig.MAX_ACTIONS_PER_WINDOW,
                            ServerConfig.RATE_LIMIT_WINDOW,
                        )
                    ) {
                        continue;
                    }
                    if (action.kind === "interact") {
                        const target = this.core.ObjectsManager.get(action.targetId);
                        if (target && player.Transform.distanceTo(target.Transform) < 75) target.interact();
                    } else if (action.kind === "switchWeapon" && this.adventure) {
                        const progression = this.adventure.state().players.find((entry) => entry.id === player.ID);
                        if (progression) {
                            const available = WEAPONS.filter((weapon) => weapon.unlockLevel <= progression.level);
                            const index = available.findIndex((weapon) => weapon.id === progression.weapon);
                            const next = available[(index + 1) % available.length];
                            if (next) this.adventure.chooseWeapon(player.ID, next.id);
                        }
                    } else player.setInput(commandToSnapshot({ ...command, actions: [action] }));
                }
                // The world performs the final command's movement normally.
                // Additional input steps use the same collision and boundary
                // rules as prediction, without ticking every enemy again.
                if (index < commands.length - 1)
                    simulateMovement(player, this.core.CollisionsSystem, this.core.Runtime.config.fixedDeltaMs, () =>
                        this.core.ChunksManager.rebuildOne(player),
                    );
                state.lastProcessed = command.seq;
            }
        }
    }

    private sendSnapshot(client: ServerClient, first = false, captured?: Map<string, EntityState>): void {
        const player = this.getReadyPlayer(client);
        const state = this.snapshotClients.get(client);
        if (!player || !state) return;
        const prepared = state.replication.prepare(this.core, player, state.lastProcessed, captured);
        const frames =
            client.ProtocolVersion === 3 ? encodeSnapshotV3(prepared.snapshot) : encodeSnapshot(prepared.snapshot);
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
        this.snapshotClients.clear();
        this.userIdToSocketMap.clear();
        this.lastChunkSent.clear();
        this.expedition?.dispose();
        this.expedition = null;
        this.adventure?.dispose();
        this.adventure = null;
        this.performance?.dispose();
        this.performance = null;
        this.performanceMetrics = null;
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

    /** Plain diagnostic data; never exposes live world objects across a worker boundary. */
    public getDiagnostics(): GameServerDiagnostics {
        return {
            serverTick: this.core.Runtime.tick,
            at: performance.now(),
            droppedTimeMs: this.core.droppedTimeMs,
            performance: this.performance?.state(0, this.performanceMetrics?.read()) ?? null,
            clients: this.clients.size,
            gameTimerActive: this.gameTimer !== null,
            updateTimerActive: this.updateTimer !== null,
        };
    }

    public subscribeStepTiming(listener: (durationMs: number, enemies: number) => void): () => void {
        return this.core.subscribeAfterStep(() => {
            if (this.performance) listener(this.performance.LastTickDurationMs, this.performance.EnemyCount);
        });
    }

    private startGame() {
        this.expedition?.start();
        this.options.seedWorld?.(this.core);

        const now = performance.now();
        this.gameSchedule.reset(now);
        this.updateSchedule.reset(now);
        this.startGameLoop();
        this.startUpdateLoop();
    }

    private startGameLoop() {
        if (!this.running) {
            return;
        }
        this.core.gameLoop();
        this.checkDisconnectInterval();
        if (!this.running) return;

        this.gameTimer = setTimeout(() => {
            this.startGameLoop();
        }, this.gameSchedule.nextDelay(performance.now()));
    }

    private startUpdateLoop() {
        if (!this.running) {
            return;
        }
        this.updateTimer = setTimeout(() => {
            this.collectAndSendUpdate();
            this.startUpdateLoop();
        }, this.updateSchedule.nextDelay(performance.now()));
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

    private onConnection(socket: GameConnection) {
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
        } else if (typeof socket.displayName === "string") {
            serverClient.Name = this.sanitizePlayerName(socket.displayName);
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
            if ((this.expedition || this.performance) && !isSnapshotProtocol(serverClient.ProtocolVersion)) {
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
                this.adventure?.join(player);

                socket.emit(SocketMsgs.INITIALIZE_GAME, {
                    id: player.ID,
                    protocolVersion: serverClient.ProtocolVersion,
                    fixedDeltaMs: this.core.Runtime.config.fixedDeltaMs,
                });

                if (isSnapshotProtocol(serverClient.ProtocolVersion)) {
                    this.snapshotClients.set(serverClient, {
                        queue: [],
                        lastReceived: null,
                        lastProcessed: null,
                        replication: new ReplicationSession(
                            serverClient.ProtocolVersion === 3 ? VIEWPORT_INTEREST : undefined,
                        ),
                        movementBudget: new InputMovementBudget(
                            this.core.Runtime.config.fixedDeltaMs,
                            this.options.world?.clock?.() ?? performance.now(),
                        ),
                    });
                    this.sendSnapshot(serverClient, true);
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
                !isSnapshotProtocol(serverClient.ProtocolVersion) ||
                !serverClient.allowEvent("performance-setup", 1, 1000)
            )
                return;
            const now = Date.now();
            if (now - this.lastPerformanceConfiguration < 1000) return;
            try {
                this.performance.configure(configuration, player.Transform.Position);
                this.performanceMetrics?.reset(performance.now(), this.core.Runtime.tick);
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
                this.adventure?.reset();
                for (const state of this.snapshotClients.values()) state.queue.length = 0;
                this.broadcastExpeditionState(true);
            }
        });

        for (const [event, choose] of [
            [AdventureEvents.UPGRADE, (id: string, value: unknown) => this.adventure?.chooseUpgrade(id, value)],
            [AdventureEvents.WEAPON, (id: string, value: unknown) => this.adventure?.chooseWeapon(id, value)],
        ] as const) {
            socket.on(event, (value: unknown) => {
                const player = this.getReadyPlayer(serverClient);
                if (
                    !this.adventure ||
                    !player ||
                    !isSnapshotProtocol(serverClient.ProtocolVersion) ||
                    this.expedition?.state().phase !== "active" ||
                    !serverClient.allowEvent("adventure-choice", 8, 1000)
                )
                    return;
                choose(player.ID, value);
                this.broadcastExpeditionState(true);
            });
        }

        socket.on(SocketMsgs.INPUT_SNAPSHOT, (snapshotData: unknown) => {
            if (isSnapshotProtocol(serverClient.ProtocolVersion) && this.isConnectedClient(serverClient)) {
                const state = this.snapshotClients.get(serverClient);
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
        // Immutable captures live for this publication only; client baselines remain independent.
        const captured = new Map<string, EntityState>();
        this.clients.forEach((client: ServerClient) => {
            if (isSnapshotProtocol(client.ProtocolVersion)) {
                try {
                    this.sendSnapshot(client, false, captured);
                } catch (error) {
                    console.error("Cannot encode snapshot update", error);
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
        const startedAt = this.performanceMetrics ? performance.now() : 0;
        const needsLegacy = Array.from(this.clients.values()).some(
            (client) => client.IsReady && client.ProtocolVersion === 1,
        );
        const legacyFrames = needsLegacy ? this.core.collectUpdateFrames() : new Map<Chunk, ArrayBuffer[]>();
        if (!needsLegacy) this.core.discardLegacyUpdate();
        this.sendUpdate(legacyFrames);
        this.broadcastExpeditionState();
        if (this.performanceMetrics) {
            const completedAt = performance.now();
            this.performanceMetrics.recordSnapshot(completedAt - startedAt, completedAt, this.core.Runtime.tick);
        }
        this.broadcastPerformanceState();
    }

    private broadcastPerformanceState(force = false): void {
        const now = Date.now();
        if (!this.performance || (!force && now - this.lastPerformanceBroadcast < 250)) return;
        this.lastPerformanceBroadcast = now;
        for (const client of this.clients.values()) {
            if (!client.IsReady || !isSnapshotProtocol(client.ProtocolVersion)) continue;
            const traffic = this.snapshotTraffic.get(client);
            if (traffic && now - traffic.startedAt >= 1000) {
                traffic.rate = traffic.bytes / ((now - traffic.startedAt) / 1000);
                traffic.bytes = 0;
                traffic.startedAt = now;
            }
            client.Socket.emit(
                PerformanceEvents.STATE,
                this.performance.state(traffic?.rate ?? 0, this.performanceMetrics?.read()),
            );
        }
    }

    private broadcastExpeditionState(force = false): void {
        if (!this.expedition || (!force && this.core.Runtime.timeMs - this.lastExpeditionBroadcast < 200)) return;
        this.lastExpeditionBroadcast = this.core.Runtime.timeMs;
        const state = this.expedition.state();
        const adventure = this.adventure?.state();
        for (const client of this.clients.values()) {
            if (client.IsReady && isSnapshotProtocol(client.ProtocolVersion)) {
                client.Socket.emit(ExpeditionEvents.STATE, state);
                if (adventure) client.Socket.emit(AdventureEvents.STATE, adventure);
            }
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
        this.snapshotClients.delete(client);
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
                this.adventure?.leave(playerId);
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
