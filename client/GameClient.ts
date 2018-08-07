/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {GameWorld} from "../common/GameWorld";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./input/InputHandler";
import {UpdateCollector} from "../common/serialize/UpdateCollector";
import {GameObjectsFactory} from "../common/game_utils/factory/ObjectsFactory";
import {HeartBeatSender} from "./net/HeartBeatSender";
import {SocketMsgs} from "../common/net/SocketMsgs";
import {Chat} from "./Chat";
import {InputSender} from ".//net/InputSender";
import {DeltaTimer} from "../common/DeltaTimer";
import {DebugWindowHtmlHandler} from "./graphic/HtmlHandlers/DebugWindowHtmlHandler";
import {Player} from "../common/game_utils/game/objects/Player";
import {InputSnapshot} from "../common/input/InputSnapshot";
import {Cursor} from "./input/Cursor";
import {Transform} from "../common/game_utils/physics/Transform";
import {AverageCounter} from "../common/utils/AverageCounter";
import {ChunksManager} from "../common/game_utils/chunks/ChunksManager";
import {Chunk} from "../common/game_utils/chunks/Chunk";

const customParser = require('socket.io-msgpack-parser');
// import * as io from "socket.io-client"
const io = require('socket.io-client');

export class GameClient {
    private socket: SocketIOClient.Socket;

    private world: GameWorld;
    private chunksManager: ChunksManager;
    private updateCollector: UpdateCollector = null;

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
        // this.socket = io.connect({
        //     reconnection: false,
        //     parser: customParser
        // });
        // workaround to lack off parser type in socketio types
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
        let delta: number = this.timer.getDelta();
        this.world.update(delta);
        this.clearUnusedChunks();

        let deltaAvg: number = this.fpsAvgCounter.calculate(delta);

        DebugWindowHtmlHandler.Instance.Fps = (1000 / deltaAvg).toFixed(2).toString();
        DebugWindowHtmlHandler.Instance.GameObjectCounter = this.world.GameObjectsMapById.size.toString();
        DebugWindowHtmlHandler.Instance.Position = "x: " + this.localPlayer.Transform.X.toFixed(2) +
            " y: " + this.localPlayer.Transform.Y.toFixed(2);

        this.renderer.update();

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
        this.chunksManager = new ChunksManager();
        this.world = new GameWorld(this.chunksManager);

        this.renderer.ChunksManager = this.chunksManager;
        this.updateCollector = new UpdateCollector(this.chunksManager);

        this.cursor = GameObjectsFactory.InstatiateManually(new Cursor(new Transform(1,1,1))) as Cursor;

        this.inputHandler = new InputHandler(this.cursor);

        this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));
        this.inputHandler.addSnapshotCallback((snapshot: InputSnapshot) => {
            if(this.localPlayer) {
                this.localPlayer.setInput(snapshot);
            }
        });
    }

    private onFirstUpdate(data: any) {
        this.onServerUpdate(data);

        this.localPlayer = this.world.getGameObject(this.localPlayerId) as Player;
        this.renderer.FocusedObject = this.localPlayer;

        this.heartBeatSender.sendHeartBeat(); //move to INITIALIZE_GAME ??

        this.startGameLoop();
    }

    private onServerUpdate(update: Array<ArrayBuffer>) {
        for (let i = 0; i < update.length; i++) {
            this.updateCollector.decodeUpdate(update[i][1], this.localPlayer, this.world.CollisionsSystem);
        }
    }

    private onUpdateSnapshotData(lastSnapshotData?: [number, number]) {
        if(this.localPlayer) {
            this.localPlayer.LastServerSnapshotData = lastSnapshotData;
        }
    }

    private clearUnusedChunks() {
        let playerChunks: Array<Chunk> = [this.chunksManager.getObjectChunk(this.localPlayer)];
        playerChunks = playerChunks.concat(playerChunks[0].Neighbors);

        let chunk: Chunk;
        let chunksIter = this.chunksManager.ChunksIterator();
        while(chunk = chunksIter.next().value) {
            if(playerChunks.indexOf(chunk) == -1) {
                while (chunk .Objects.length) {
                    chunk.Objects[0].destroy();
                }
            }
        }
    }
}