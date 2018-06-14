/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {GameWorld} from "../common/GameWorld";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./input/InputHandler";
import {NetObjectsManager} from "../common/net/NetObjectsManager";
import {GameObjectsFactory} from "../common/utils/game/ObjectsFactory";
import {HeartBeatSender} from "./net/HeartBeatSender";
import {GameObject} from "../common/utils/game/GameObject";
import {SocketMsgs} from "../common/net/SocketMsgs";
import {Chat} from "./Chat";
import {InputSender} from ".//net/InputSender";
import {DeltaTimer} from "../common/DeltaTimer";
import {DebugWindowHtmlHandler} from "./graphic/HtmlHandlers/DebugWindowHtmlHandler";
import {Player} from "../common/utils/game/Player";
import {InputSnapshot} from "../common/input/InputSnapshot";
import {Types} from "../common/utils/game/GameObjectTypes";
import * as LZString from "lz-string";
import * as io from "socket.io-client"
import {Cursor} from "./input/Cursor";
import {Transform} from "../common/utils/physics/Transform";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private world: GameWorld;
    private chat: Chat;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private heartBeatSender: HeartBeatSender;
    private inputSender: InputSender;
    private cursor: Cursor;

    private localPlayer: Player = null;

    private timer: DeltaTimer = new DeltaTimer;
    private deltaHistory: Array<number> = [];

    constructor() {
        this.connect();
        this.inputSender = new InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender(this.socket);
        this.chat = new Chat(this.socket);

        this.renderer = new Renderer(() => {
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
        this.socket.on(SocketMsgs.INITIALIZE_GAME, (data) => {
            let worldInfo: Array<string> = data['world'].split(',');
            let width: number = Number(worldInfo[0]);
            let height: number = Number(worldInfo[1]);

            this.world = new GameWorld(width, height);

            this.renderer.setMap();

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
        this.cursor = GameObjectsFactory.InstatiateWithTransform("Cursor", new Transform(1,1,1)) as Cursor;
        this.inputHandler = new InputHandler(this.cursor);

        this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));
        this.inputHandler.addSnapshotCallback((snapshot: InputSnapshot) => {
            if(this.localPlayer) {
                this.localPlayer.setInput(snapshot);
            }
        });

        this.startGameLoop();
    }

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
        DebugWindowHtmlHandler.Instance.GameObjectCounter = this.world.GameObjectsMapById.size.toString();

        this.renderer.update();

        let deviation: [number, number] = this.renderer.CameraDeviation;
        this.cursor.Transform.X = this.localPlayer.Transform.X + deviation[0];
        this.cursor.Transform.Y = this.localPlayer.Transform.Y + deviation[1];

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
                gameObject = NetObjectsManager.Instance.getGameObject(id);
                if (gameObject) {
                    gameObject.destroy();
                }
                continue;
            }

            gameObject = NetObjectsManager.Instance.getGameObject(id);

            if (gameObject == null) {
                gameObject = GameObjectsFactory.Instatiate(Types.IdToClass.get(id[0]), id, data);
            }
            gameObject.deserialize(data);
            // if (lastSnapshotData && this.localPlayer.ID == id) {
                // this.localPlayer.reconciliation(lastSnapshotData, this.world.SpatialGrid);
            // }
        }
    }
}