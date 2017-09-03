/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {GameWorld} from "../Common/GameWorld";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./input/InputHandler";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {GameObjectsFactory} from "../Common/utils/game/ObjectsFactory";
import {HeartBeatSender} from "./net/HeartBeatSender";
import {GameObject} from "../Common/utils/game/GameObject";
import {SocketMsgs} from "../Common/net/SocketMsgs";
import {Chat} from "./Chat";
import {InputSender} from "../Client/net/InputSender";
import {DeltaTimer} from "../Common/DeltaTimer";
import {DebugWindowHtmlHandler} from "./graphic/HtmlHandlers/DebugWindowHtmlHandler";
import {Player} from "../Common/utils/game/Player";
import {InputSnapshot} from "../Common/input/InputSnapshot";
import {Types} from "../Common/utils/game/GameObjectTypes";
import * as LZString from "lz-string";
import * as io from "socket.io-client"

export class GameClient {
    private socket: SocketIOClient.Socket;
    private world: GameWorld;
    private chat: Chat;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private heartBeatSender: HeartBeatSender;
    private inputSender: InputSender;

    private localPlayer: Player = null;

    constructor() {
        this.connect();
        this.inputSender = new InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender(this.socket);
        this.chat = new Chat(this.socket);

        this.renderer = new Renderer(() => {
            this.inputHandler = new InputHandler();
            this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));
            this.inputHandler.addSnapshotCallback((snapshot: InputSnapshot) => {
                if(this.localPlayer) {
                    this.localPlayer.setInput(snapshot);
                }
            });

            this.socket.emit(SocketMsgs.CLIENT_READY);
        });
    }

    private connect() {
        this.socket = io.connect({
            reconnection: false
        });

        if(this.socket != null) {
            this.configureSocket();
        } else {
            throw new Error("Cannot connect to server")
        }
    }

    private configureSocket() {
        this.socket.on(SocketMsgs.START_GAME, this.startGame.bind(this));
        this.socket.on(SocketMsgs.INITIALIZE_GAME, (data) => {
            console.log(data);
            let worldInfo: Array<string> = data['world'].split(',');
            let width: number = Number(worldInfo[0]);
            let height: number = Number(worldInfo[1]);

            this.world = new GameWorld(width, height);

            this.renderer.setMap();

            GameObjectsFactory.ObjectHolderSubscribers.push(this.renderer);
            GameObjectsFactory.ObjectHolderSubscribers.push(this.world);
            GameObjectsFactory.ObjectHolderSubscribers.push(NetObjectsManager.Instance);
            this.onServerUpdate(data['update']);
            this.localPlayer = this.world.getGameObject(data['id']) as Player;
            this.renderer.CameraFollower = this.localPlayer;

            this.heartBeatSender.sendHeartBeat();

            this.startGame();
            this.socket.on(SocketMsgs.UPDATE_GAME, this.onServerUpdate.bind(this));

            this.socket.on(SocketMsgs.ERROR, (err: string) => {
                console.log(err);
            });
        });
    }

    private startGame() {
        this.startGameLoop();
    }

    timer: DeltaTimer = new DeltaTimer;
    deltaHistory: Array<number> = [];

    private startGameLoop() {
        let delta: number = this.timer.getDelta();
        this.world.update(delta);

        this.deltaHistory.push(delta);
        if(this.deltaHistory.length > 30) this.deltaHistory.splice(0, 1);
        let deltaAvg: number = 0;
        this.deltaHistory.forEach((delta: number) => {
            deltaAvg += delta;
        });
        deltaAvg /= this.deltaHistory.length;
        DebugWindowHtmlHandler.Instance.Fps = (1000 / deltaAvg).toFixed(2).toString();

        this.renderer.update();
        requestAnimationFrame(this.startGameLoop.bind(this));
    }

    private onServerUpdate(data, lastSnapshotData?: [number, number]) {
        if(!data) return;
        data = LZString.decompressFromUTF16(data);

        let update: Array<string> = data.split('$');
        // console.log(update);
        for (let object in update) {
            let splitObject: string[] = update[object].split('=');
            let id: string = splitObject[0];
            let data: string = splitObject[1];

            let gameObject: GameObject = null;
            if (id[0] == '!') {
                id = id.slice(1);
                gameObject = NetObjectsManager.Instance.getObject(id);
                if (gameObject) {
                    gameObject.destroy();
                }
                continue;
            }

            gameObject = NetObjectsManager.Instance.getObject(id);

            if (gameObject == null) {
                gameObject = GameObjectsFactory.Instatiate(Types.IdToClass.get(id[0]), id, data);
            }
            gameObject.deserialize(data);
            if (lastSnapshotData && this.localPlayer.ID == id) {
                this.localPlayer.reconciliation(lastSnapshotData, this.world.SpatialGrid);
            }
        }
    }
}