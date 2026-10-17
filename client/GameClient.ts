import { Origin } from "../shared/SharedConfig";
import {
    InputCommand,
    InputAction,
    InputDirection,
    decodeSnapshot,
    decodeSnapshotV3,
    isNewerSequence,
    nextSequence,
} from "../shared/protocol";
import { INPUT_COMMAND } from "../shared/input/InputCommands";
import { applySnapshot } from "../shared/replication/EntityAdapter";
import { SnapshotInterpolator } from "./net/SnapshotInterpolator";
import { V2Prediction } from "./net/V2Prediction";
import { snapshotActions } from "../shared/replication/InputCommandAdapter";
import { io, Socket } from "socket.io-client";
import * as customParser from "socket.io-msgpack-parser";
import { Renderer } from "./graphic/Renderer";
import { InputHandler } from "./input/InputHandler";
import { HeartBeatSender } from "./net/HeartBeatSender";
import { SocketMsgs } from "../shared/net/SocketMsgs";
import { Chat } from "./Chat";
import { InputSender } from "./net/InputSender";
import { DebugWindowHtmlHandler } from "./graphic/HtmlHandlers/DebugWindowHtmlHandler";
import { Player } from "../shared/game_utils/game/objects/Player";
import { InputSnapshot } from "../shared/input/InputSnapshot";
import { Cursor } from "./input/Cursor";
import { Transform } from "../shared/game_utils/physics/Transform";
import { AverageCounter } from "../shared/utils/AverageCounter";
import { Chunk } from "../shared/chunks/Chunk";
import { GameCore } from "../shared/GameCore";
import { GameObjectsManager } from "../shared/game_utils/factory/GameObjectsManager";
import { Reconciliation } from "./Reconciliation";
import { TicksCounter } from "../shared/utils/TicksCounter";
import { normalizeBinaryPayload } from "./net/BinaryPayload";
import {
    Protocol,
    ProtocolVersion,
    protocolVersionFromInitializePayload,
    isSnapshotProtocol,
} from "../shared/net/Protocol";
import { ExpeditionEvents, ExpeditionState, isExpeditionState } from "../shared/gameplay/Expedition";
import { ExpeditionHud } from "./graphic/ExpeditionHud";
import { PerformancePanel } from "./graphic/PerformancePanel";
import { FixedStepPresentation } from "./graphic/FixedStepPresentation";
import { AdventureEvents, AdventureState, isAdventureState } from "../shared/gameplay/Adventure";
import { AdventureHud } from "./graphic/AdventureHud";

export interface GameClientOptions {
    performanceMode?: boolean;
    socket?: Socket;
    createRenderer?: (objects: GameObjectsManager) => Promise<Renderer>;
    createChat?: (socket: Socket) => Chat;
    requestFrame?: (callback: FrameRequestCallback) => number;
    cancelFrame?: (id: number) => void;
}

export class GameClient {
    private heldHorizontal: InputDirection = 0;
    private heldVertical: InputDirection = 0;
    private queuedActions: InputAction[] = [];
    private nextInputSequence = 0;
    private lastSnapshotId: number | null = null;
    private prediction: V2Prediction | null = null;
    private interpolator: SnapshotInterpolator | null = null;
    private readonly localPresentation = new FixedStepPresentation();
    private readonly socket: Socket;
    private readonly core: GameCore;
    private reconciliation: Reconciliation | null = null;
    private renderer: Renderer | null = null;
    private readonly chat: Chat;
    private readonly expeditionHud: ExpeditionHud | null;
    private readonly adventureHud: AdventureHud | null;
    private adventureState: AdventureState | null = null;
    private readonly performancePanel: PerformancePanel | null;
    private expeditionState: ExpeditionState | null = null;
    private connectionError: string | null = null;
    private inputHandler: InputHandler | null = null;
    private readonly heartBeatSender: HeartBeatSender;
    private readonly inputSender: InputSender;
    private cursor: Cursor | null = null;
    private readonly fpsAvgCounter = new AverageCounter(30);
    private localPlayer: Player | null = null;
    private localPlayerId = "";
    private protocolVersion: ProtocolVersion | null = null;
    private readonly tickCounter = TicksCounter.Instance;
    private coreChunk: Chunk | null = null;
    private disposed = false;
    private readySent = false;
    private initialized = false;
    private loopStarted = false;
    private frameId: number | null = null;
    private lastFrameTime: number | null = null;
    private readonly requestFrame: (callback: FrameRequestCallback) => number;
    private readonly cancelFrame: (id: number) => void;
    private readonly pageHideHandler = () => this.dispose();
    private readonly socketHandlers: Array<[string, (data?: unknown) => void]> = [
        [SocketMsgs.INITIALIZE_GAME, (data) => this.onInitializeGame(data)],
        [SocketMsgs.FIRST_UPDATE_GAME, (data) => this.onFirstUpdate(data)],
        [SocketMsgs.UPDATE_SNAPSHOT_DATA, (data) => this.onUpdateSnapshotData(data)],
        [SocketMsgs.UPDATE_GAME, (data) => this.onServerUpdate(data)],
        [SocketMsgs.CHUNK_CHANGED, (data) => this.onChunkMoved(data)],
        [SocketMsgs.ERROR, (data) => this.onConnectionError(data)],
        [SocketMsgs.DISCONNECT, () => this.onConnectionLost()],
        ["connect_error", () => this.onConnectionLost()],
        [ExpeditionEvents.STATE, (data) => this.onExpeditionState(data)],
        [AdventureEvents.STATE, (data) => this.onAdventureState(data)],
    ];

    constructor(options: GameClientOptions = {}) {
        this.core = new GameCore({ role: Origin.CLIENT, performanceMode: options.performanceMode ?? false });
        this.core.subscribeBeforeStep(() => this.predictTick());
        this.core.subscribeAfterStep(() => {
            if (isSnapshotProtocol(this.protocolVersion) && this.localPlayer)
                this.localPresentation.capture(this.localPlayer.Transform.Position);
        });
        this.socket =
            options.socket ??
            io(options.performanceMode ? "/performance" : "/", { reconnection: false, parser: customParser });
        this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
        this.cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
        this.inputSender = new InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender(this.socket);
        this.chat = options.createChat ? options.createChat(this.socket) : new Chat(this.socket);
        this.expeditionHud = ExpeditionHud.create(() => this.socket.emit(ExpeditionEvents.RESTART));
        this.adventureHud = options.performanceMode
            ? null
            : AdventureHud.create(
                  (id) => this.socket.emit(AdventureEvents.UPGRADE, id),
                  (id) => this.socket.emit(AdventureEvents.WEAPON, id),
                  (id) => this.socket.emit(AdventureEvents.PURCHASE, id),
              );
        const performanceRoot = typeof document === "undefined" ? null : document.getElementById("performance-panel");
        this.performancePanel =
            options.performanceMode && performanceRoot ? new PerformancePanel(this.socket, performanceRoot) : null;
        for (const [event, handler] of this.socketHandlers) this.socket.on(event, handler);
        if (typeof window !== "undefined") window.addEventListener("pagehide", this.pageHideHandler);
        void this.initializeRenderer(
            options.createRenderer ??
                ((objects) =>
                    Renderer.create(objects, {
                        ...this.core.Runtime.config,
                        terrain: this.expeditionHud ? "village" : "legacy",
                    })),
        );
    }

    private async initializeRenderer(
        createRenderer: (objects: GameObjectsManager) => Promise<Renderer>,
    ): Promise<void> {
        try {
            const renderer = await createRenderer(this.core.ObjectsManager);
            if (this.disposed) {
                renderer.dispose();
                return;
            }
            this.renderer = renderer;
            renderer.createHUD();
            if (this.expeditionState) renderer.setExpeditionState(this.expeditionState);
            if (this.adventureState)
                for (const player of this.adventureState.players) renderer.setAdventureWeapon(player.id, player.weapon);
            if (!this.readySent) {
                this.readySent = true;
                this.socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [...Protocol.SUPPORTED] });
            }
        } catch (error) {
            if (!this.disposed) console.error("Cannot initialize the renderer", error);
            this.onConnectionError("Nie udało się wczytać grafiki gry. Odśwież stronę, aby spróbować ponownie.");
            this.dispose();
        }
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        if (this.frameId !== null) this.cancelFrame(this.frameId);
        this.frameId = null;
        for (const [event, handler] of this.socketHandlers) this.socket.off(event, handler);
        if (typeof window !== "undefined") window.removeEventListener("pagehide", this.pageHideHandler);
        const cleanup: Array<() => void> = [
            () => this.inputHandler?.dispose(),
            () => this.inputSender.dispose(),
            () => this.heartBeatSender.dispose(),
            () => this.chat.dispose(),
            () => this.expeditionHud?.dispose(),
            () => this.adventureHud?.dispose(),
            () => this.performancePanel?.dispose(),
            () => {
                if (this.cursor) {
                    this.core.CollisionsSystem.removeObject(this.cursor);
                    this.cursor.destroy();
                }
            },
            () => this.renderer?.dispose(),
            () => this.core.dispose(),
            () => this.socket.disconnect(),
        ];
        for (const release of cleanup) {
            try {
                release();
            } catch (error) {
                console.error("Client cleanup failed", error);
            }
        }
        this.renderer = null;
        this.cursor = null;
        this.localPlayer = null;
        this.reconciliation = null;
        this.prediction = null;
        this.interpolator = null;
        this.queuedActions = [];
        this.expeditionState = null;
        this.adventureState = null;
    }

    private readonly startGameLoop = (timestamp: number): void => {
        this.frameId = null;
        if (this.disposed || !this.renderer || !this.localPlayer || !this.cursor) return;
        const deltaMs = this.lastFrameTime === null ? 0 : Math.max(0, timestamp - this.lastFrameTime);
        this.lastFrameTime = timestamp;
        try {
            this.core.advance(deltaMs);
        } catch (error) {
            console.error("Prediction stopped", error);
            this.onConnectionError("Symulacja klienta została zatrzymana. Odśwież stronę, aby dołączyć ponownie.");
            this.dispose();
            return;
        }
        if (this.interpolator)
            for (const [id, position] of this.interpolator.positions()) {
                this.renderer.setPresentationPosition(id, position);
            }
        if (isSnapshotProtocol(this.protocolVersion))
            this.renderer.setPresentationPosition(
                this.localPlayerId,
                this.localPresentation.position(this.core.SimulationAlpha),
            );
        const chunk = this.core.ChunksManager.getObjectChunk(this.localPlayer);
        if (chunk) this.renderer.setCurrentChunk(chunk);
        this.renderer.update(deltaMs);
        this.expeditionHud?.update(this.localPlayer.Transform.Position);
        this.performancePanel?.updateFrame(
            deltaMs,
            this.renderer.VisibleObjectCount,
            this.core.ObjectsManager.ObjectsById.size,
        );
        this.updateDebugWindow(deltaMs);
        this.updateCursor();
        this.core.CollisionsSystem.update();
        this.core.CollisionsSystem.updateCollisionsForGameObject(this.cursor);
        this.tickCounter.update();
        if (!this.disposed) this.frameId = this.requestFrame(this.startGameLoop);
    };

    private onInitializeGame(data: unknown): void {
        if (this.disposed || this.initialized || !this.readySent) return;
        const protocolVersion = protocolVersionFromInitializePayload(data);
        const playerId =
            typeof data === "object" && data !== null && !Array.isArray(data)
                ? (data as Record<string, unknown>).id
                : undefined;
        if (protocolVersion === null || typeof playerId !== "string" || !playerId) {
            console.error("Server returned an invalid protocol initialization payload");
            this.onConnectionError("Nie udało się rozpocząć gry. Odśwież stronę, aby dołączyć ponownie.");
            this.dispose();
            return;
        }
        this.initialized = true;
        this.protocolVersion = protocolVersion;
        this.performancePanel?.setProtocol(protocolVersion);
        this.localPlayerId = playerId;
        this.expeditionHud?.setLocalPlayer(playerId);
        this.adventureHud?.setLocalPlayerId(playerId);
        const health = this.expeditionState?.party.find((player) => player.id === playerId);
        if (health) this.adventureHud?.setHealth(health.hp, health.maxHp);
        this.reconciliation = new Reconciliation();
        if (isSnapshotProtocol(protocolVersion)) {
            const fixedDelta = (data as Record<string, unknown>).fixedDeltaMs;
            if (fixedDelta !== this.core.Runtime.config.fixedDeltaMs) {
                this.onConnectionError("Klient i serwer używają różnych ustawień gry. Odśwież stronę.");
                this.dispose();
                return;
            }
            this.prediction = new V2Prediction(fixedDelta);
            this.interpolator = new SnapshotInterpolator(fixedDelta);
        }
        this.cursor = new Cursor(new Transform([1, 1], 1));
        this.cursor.setRuntime(this.core.Runtime);
        this.core.CollisionsSystem.insertObject(this.cursor);
        this.heartBeatSender.sendHeartBeat();
        this.inputHandler = new InputHandler(this.cursor, (event) => this.updateCursor(event));
        this.inputHandler.addSnapshotCallback((snapshot: InputSnapshot) => {
            if (!this.disposed && this.localPlayer && this.reconciliation) {
                if (isSnapshotProtocol(this.protocolVersion)) {
                    this.heldHorizontal = Number(
                        snapshot.Commands.get(INPUT_COMMAND.HORIZONTAL) ?? 0,
                    ) as InputDirection;
                    this.heldVertical = Number(snapshot.Commands.get(INPUT_COMMAND.VERTICAL) ?? 0) as InputDirection;
                    this.queuedActions.push(...snapshotActions(snapshot));
                    if (this.queuedActions.length > 64) this.dispose();
                    return;
                }
                this.reconciliation.pushSnapshotToHistory(snapshot);
                this.inputSender.sendInput(snapshot);
                this.localPlayer.setInput(snapshot);
            }
        });
    }

    private updateCursor(event?: MouseEvent): void {
        if (!this.renderer || !this.cursor) return;
        if (event) this.renderer.updatePointer(event);
        const [x, y] = this.renderer.PointerWorldPosition;
        this.cursor.move(x, y);
    }

    private onFirstUpdate(data: unknown): void {
        if (this.disposed || !this.initialized || this.loopStarted || !this.renderer) return;
        this.onServerUpdate(data);
        if (this.disposed) return;
        const player = this.core.ObjectsManager.get(this.localPlayerId);
        if (!(player instanceof Player)) {
            console.error("The initial server update did not contain the local player");
            this.onConnectionError("Nie udało się dołączyć do świata. Odśwież stronę, aby spróbować ponownie.");
            this.dispose();
            return;
        }
        this.localPlayer = player;
        this.localPresentation.reset(player.Transform.Position);
        this.renderer.FocusedObject = player;
        this.loopStarted = true;
        this.frameId = this.requestFrame(this.startGameLoop);
    }

    private onServerUpdate(update: unknown): void {
        if (this.disposed) return;
        if (!Array.isArray(update)) {
            console.warn("Ignoring a malformed server update");
            return;
        }
        try {
            if (isSnapshotProtocol(this.protocolVersion)) {
                const wasDead = this.localPlayer !== null && this.localPlayer.HP <= 0;
                const predictedPosition = this.localPlayer?.Transform.Position;
                const frames = update.map((payload) => normalizeBinaryPayload(payload));
                if (frames.some((frame) => frame === null)) throw new Error("Malformed snapshot frame");
                const snapshot =
                    this.protocolVersion === 3
                        ? decodeSnapshotV3(frames as ArrayBuffer[])
                        : decodeSnapshot(frames as ArrayBuffer[]);
                if (this.lastSnapshotId !== null && !isNewerSequence(snapshot.snapshotId, this.lastSnapshotId)) return;
                applySnapshot(this.core, snapshot);
                this.lastSnapshotId = snapshot.snapshotId;
                const player = this.core.ObjectsManager.get(this.localPlayerId);
                for (const object of this.core.ObjectsManager.ObjectsById.values())
                    object.predictionEnabled = object.ID === this.localPlayerId;
                if (player instanceof Player && snapshot.localPlayerState && this.prediction) {
                    this.prediction.reconcile(
                        player,
                        snapshot.localPlayerState,
                        snapshot.lastProcessedInputSeq,
                        this.core.CollisionsSystem,
                        this.core.ChunksManager,
                    );
                    if (predictedPosition)
                        this.performancePanel?.updateCorrection(
                            Math.hypot(
                                player.Transform.X - predictedPosition[0],
                                player.Transform.Y - predictedPosition[1],
                            ),
                        );
                    this.localPresentation.reconcile(player.Transform.Position, wasDead && player.HP > 0);
                }
                this.interpolator?.pushObjects(
                    snapshot.serverTick,
                    this.core.ObjectsManager.ObjectsById.values(),
                    this.localPlayerId,
                );
                return;
            }
            const legacyFrames = update.map((payload) => normalizeBinaryPayload(payload));
            if (legacyFrames.some((frame) => frame === null)) throw new Error("Malformed binary update payload");
            this.core.decodeUpdateFrames(legacyFrames as ArrayBuffer[]);
            if (this.localPlayer && this.reconciliation) {
                this.reconciliation.reconciliation(this.localPlayer, this.core.CollisionsSystem);
            }
            if (this.coreChunk) {
                this.core.ChunksManager.rebuild();
                this.clearUnusedChunks(this.coreChunk);
            }
        } catch (error) {
            console.error("Cannot decode server update", error);
            this.onConnectionError("Nie udało się odczytać stanu świata. Odśwież stronę, aby dołączyć ponownie.");
            this.dispose();
        }
    }

    private predictTick(): void {
        if (!isSnapshotProtocol(this.protocolVersion) || !this.localPlayer || !this.prediction) return;
        const self = this.expeditionState?.party.find((player) => player.id === this.localPlayerId);
        const inputBlocked =
            this.expeditionState !== null &&
            (this.expeditionState.phase === "won" || this.expeditionState.phase === "lost" || self?.hp === 0);
        if (inputBlocked) this.queuedActions = [];
        const command: InputCommand = {
            seq: this.nextInputSequence,
            horizontal: inputBlocked ? 0 : this.heldHorizontal,
            vertical: inputBlocked ? 0 : this.heldVertical,
            actions: this.queuedActions.splice(0, 8),
        };
        this.nextInputSequence = nextSequence(this.nextInputSequence);
        this.prediction.predict(this.localPlayer, command);
        this.socket.emit(SocketMsgs.INPUT_SNAPSHOT, command);
    }

    private onExpeditionState(data: unknown): void {
        if (this.disposed || !isExpeditionState(data)) return;
        this.expeditionState = data;
        this.expeditionHud?.receive(data);
        this.adventureHud?.setActive(data.phase === "active");
        const health = data.party.find((player) => player.id === this.localPlayerId);
        if (health) this.adventureHud?.setHealth(health.hp, health.maxHp);
        this.renderer?.setExpeditionState(data);
    }

    private onAdventureState(data: unknown): void {
        if (this.disposed || !isAdventureState(data)) return;
        this.adventureState = data;
        this.adventureHud?.update(data);
        for (const player of data.players) this.renderer?.setAdventureWeapon(player.id, player.weapon);
    }

    private onConnectionError(data: unknown): void {
        if (this.disposed || this.connectionError !== null || typeof data !== "string" || !data.trim()) return;
        this.connectionError = data.slice(0, 256);
        this.expeditionHud?.showConnectionError(this.connectionError);
        this.adventureHud?.setConnectionError(this.connectionError);
        this.performancePanel?.showConnectionError(this.connectionError);
    }

    private onConnectionLost(): void {
        if (this.disposed) return;
        this.connectionError ??= this.performancePanel
            ? "Połączenie z poligonem zostało przerwane. Odśwież stronę, aby dołączyć ponownie."
            : "Połączenie z obozem zostało przerwane. Wróć do wejścia i spróbuj dołączyć ponownie.";
        this.expeditionHud?.showConnectionError(this.connectionError);
        this.adventureHud?.setConnectionError(this.connectionError);
        this.performancePanel?.showConnectionError(this.connectionError);
        this.dispose();
    }

    private onUpdateSnapshotData(data: unknown): void {
        if (
            Array.isArray(data) &&
            data.length === 2 &&
            Number.isSafeInteger(data[0]) &&
            data[0] >= 0 &&
            typeof data[1] === "number" &&
            Number.isFinite(data[1]) &&
            data[1] >= 0 &&
            this.reconciliation
        ) {
            this.reconciliation.LastServerSnapshotData = [data[0], data[1]];
        }
    }

    private onChunkMoved(data: unknown): void {
        if (Array.isArray(data) && data.length === 2 && Number.isInteger(data[0]) && Number.isInteger(data[1])) {
            this.coreChunk = this.core.ChunksManager.Chunks[data[0]]?.[data[1]] ?? null;
        }
    }

    private updateDebugWindow(deltaMs: number): void {
        if (!this.localPlayer) return;
        const average = this.fpsAvgCounter.calculate(deltaMs);
        DebugWindowHtmlHandler.Instance.Fps = average > 0 ? (1000 / average).toFixed(2) : "0";
        DebugWindowHtmlHandler.Instance.GameObjectCounter = this.core.ObjectsManager.ObjectsById.size.toString();
        DebugWindowHtmlHandler.Instance.Position = `x: ${this.localPlayer.Transform.X.toFixed(2)} y: ${this.localPlayer.Transform.Y.toFixed(2)}`;
    }

    private clearUnusedChunks(coreChunk: Chunk): void {
        const visible = new Set([coreChunk, ...coreChunk.Neighbors]);
        for (const chunk of this.core.ChunksManager.ChunksIterator()) {
            if (!visible.has(chunk)) chunk.clearAll();
        }
    }
}
