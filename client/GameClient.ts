/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./input/InputHandler";
import {GameObjectsFactory} from "../shared/game_utils/factory/ObjectsFactory";
import {HeartBeatSender} from "./net/HeartBeatSender";
import {SocketMsgs} from "../shared/net/SocketMsgs";
import {Chat} from "./Chat";
import {InputSender} from ".//net/InputSender";
import {DeltaTimer} from "../shared/utils/DeltaTimer";
import {DebugWindowHtmlHandler} from "./graphic/HtmlHandlers/DebugWindowHtmlHandler";
import {Player} from "../shared/game_utils/game/objects/Player";
import {InputSnapshot} from "../shared/input/InputSnapshot";
import {Cursor} from "./input/Cursor";
import {Transform} from "../shared/game_utils/physics/Transform";
import {AverageCounter} from "../shared/utils/AverageCounter";
import {Chunk} from "../shared/game_utils/chunks/Chunk";
import {GameCore} from "../shared/GameCore";
import {GameObjectsManager} from "../shared/game_utils/factory/GameObjectsManager";
import {Reconciliation} from "./Reconciliation";

const customParser = require('socket.io-msgpack-parser');
const io = require('socket.io-client');

export class GameClient {
    private socket: SocketIOClient.Socket;

    private core: GameCore;
    private reconciliation: Reconciliation;

    private renderer: Renderer;
    private chat: Chat;
    private inputHandler: InputHandler;
    private heartBeatSender: HeartBeatSender;
    private inputSender: InputSender;
    private cursor: Cursor;
    private fpsAvgCounter: AverageCounter = new AverageCounter(30);

    private localPlayer: Player = null;
    private localPlayerId: string = "";

    private timer: DeltaTimer = new DeltaTimer;

    constructor() {
        this.connect();
        this.inputSender = new InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender(this.socket);
        this.chat = new Chat(this.socket);

        this.renderer = new Renderer(() => {
            this.renderer.createHUD();
            this.socket.emit(SocketMsgs.CLIENT_READY);
        });
    }

    private connect() {
        this.socket = io({
                reconnection: false,
                parser: customParser
            });

        if(this.socket != null) {
            this.configureSocket();
        } else {
            throw new Error("Cannot connect to server")
        }
    }

    private startGameLoop() {
        this.core.gameLoop();
        this.renderer.setCurrentChunk(this.core.ChunksManager.getObjectChunk(this.localPlayer));

        this.clearUnusedChunks();

        this.renderer.update();

        this.updateDebugWindow();

        let deviation: [number, number] = this.renderer.CameraDeviation;
        this.cursor.Transform.X = this.localPlayer.Transform.X + deviation[0];
        this.cursor.Transform.Y = this.localPlayer.Transform.Y + deviation[1];

        requestAnimationFrame(this.startGameLoop.bind(this));
    }

    private configureSocket() {
        this.socket.on(SocketMsgs.INITIALIZE_GAME, (data) => {
            this.onInitializeGame(data);
        });

        this.socket.on(SocketMsgs.FIRST_UPDATE_GAME, (data) => {
            this.onFirstUpdate(data);
        });

        this.socket.on(SocketMsgs.UPDATE_SNAPSHOT_DATA, (lastSnapshotData?: [number, number]) => {
            this.onUpdateSnapshotData(lastSnapshotData);
        });

        this.socket.on(SocketMsgs.UPDATE_GAME, (data: any) => {
            this.onServerUpdate(data);
        });

        this.socket.on(SocketMsgs.ERROR, (errorMessage: string) => {
            console.log("Server error: " + errorMessage);
        });
    }

    private onInitializeGame(data: any) {
        this.localPlayerId = data['id'];

        this.reconciliation = new Reconciliation();
        this.core = new GameCore();

        this.cursor = GameObjectsFactory.InstatiateManually(new Cursor(new Transform([1,1],1))) as Cursor;

        this.heartBeatSender.sendHeartBeat();
        this.inputHandler = new InputHandler(this.cursor);

        this.inputHandler.addSnapshotCallback((snapshot: InputSnapshot) => {
            if(this.localPlayer) {
                this.reconciliation.pushSnapshotToHistory(snapshot);
                this.inputSender.sendInput(snapshot);
                this.localPlayer.setInput(snapshot);
            }
        });
    }

    private onFirstUpdate(data: any) {
        this.onServerUpdate(data);

        this.localPlayer = GameObjectsManager.GetGameObjectById(this.localPlayerId) as Player;
        this.renderer.FocusedObject = this.localPlayer;

        this.startGameLoop();
    }

    private onServerUpdate(update: Array<ArrayBuffer>) {
        for (let i = 0; i < update.length; i++) {
            this.core.decodeUpdate(update[i][1]);
        }
        if(this.localPlayer) {
            this.reconciliation.reconciliation(this.localPlayer, this.core.CollisionsSystem);
        }
    }

    private onUpdateSnapshotData(lastSnapshotData?: [number, number]) {
        this.reconciliation.LastServerSnapshotData = lastSnapshotData;
    }

    private updateDebugWindow() {
        let delta: number = this.timer.getDelta();
        let deltaAvg: number = this.fpsAvgCounter.calculate(delta);

        DebugWindowHtmlHandler.Instance.Fps = (1000 / deltaAvg).toFixed(2).toString();
        DebugWindowHtmlHandler.Instance.GameObjectCounter = GameObjectsManager.gameObjectsMapById.size.toString();
        DebugWindowHtmlHandler.Instance.Position = "x: " + this.localPlayer.Transform.X.toFixed(2) +
            " y: " + this.localPlayer.Transform.Y.toFixed(2);
    }

    private clearUnusedChunks() {
        let playerChunks: Array<Chunk> = [this.core.ChunksManager.getObjectChunk(this.localPlayer)];
        playerChunks = playerChunks.concat(playerChunks[0].Neighbors);

        let chunk: Chunk;
        let chunksIter = this.core.ChunksManager.ChunksIterator();
        while(chunk = chunksIter.next().value) {
            if(playerChunks.indexOf(chunk) == -1) {
                while (chunk .Objects.length) {
                    chunk.Objects[0].destroy();
                }
            }
        }
    }
}