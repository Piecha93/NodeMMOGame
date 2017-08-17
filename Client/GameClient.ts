/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {World} from "../Common/World";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./input/InputHandler";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {ObjectsFactory} from "../Common/utils/game/ObjectsFactory";
import {HeartBeatSender} from "./net/HeartBeatSender";
import {GameObject} from "../Common/utils/game/GameObject";
import {SocketMsgs} from "../Common/net/SocketMsgs";
import {Chat} from "./Chat";
import {InputSender} from "../Client/net/InputSender";
import {DeltaTimer} from "../Common/DeltaTimer";
import {DebugWindowHtmlHandler} from "./graphic/HtmlHandlers/DebugWindowHtmlHandler";
import {Player} from "../Common/utils/game/Player";
import {InputSnapshot} from "../Common/input/InputSnapshot";
import {ClientConfig} from "./ClientConfig";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private world: World;
    private chat: Chat;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private heartBeatSender: HeartBeatSender;
    private inputSender: InputSender;
    private netObjectMenager: NetObjectsManager = NetObjectsManager.Instance;

    private player: Player = null;

    constructor() {
        this.connect();
        this.inputSender = new InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender(this.socket);
        this.chat = new Chat(this.socket);

        this.renderer = new Renderer(() => {
            this.inputHandler = new InputHandler();
            this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));
            this.inputHandler.addSnapshotCallback((id:number, snapshot: InputSnapshot) => {
                if(this.player) {
                    this.player.setInput(snapshot.Commands);
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
            let worldInfo: Array<string> = data['world'].split(',');
            let width: number = Number(worldInfo[0]);
            let height: number = Number(worldInfo[1]);

            this.world = new World(width, height);

            this.renderer.setMap();

            ObjectsFactory.HolderSubscribers.push(this.renderer);
            ObjectsFactory.HolderSubscribers.push(this.world);
            ObjectsFactory.HolderSubscribers.push(this.netObjectMenager);

            this.updateGame(data);
            this.player = this.world.getGameObject(data['id']) as Player;
            this.renderer.CameraFollower = this.player;

            this.heartBeatSender.startSendingHeartbeats();

            this.startGame();
            // this.world.Cells.forEach((cell: Cell) => {
            //     this.renderer.addCell(cell);
            // });
            this.socket.on(SocketMsgs.UPDATE_GAME, this.updateGame.bind(this));

            this.socket.on(SocketMsgs.ERROR, (err: string) => {
                console.log(err);
            });
        });
    }

    private startGame() {
        let timer: DeltaTimer = new DeltaTimer;
        let deltaHistory: Array<number> = new Array<number>();

        setInterval(() => {
            let delta: number = timer.getDelta();
            this.world.update(delta);
            this.renderer.update();

            deltaHistory.push(delta);
            if(deltaHistory.length > 30) deltaHistory.splice(0, 1);
            let deltaAvg: number = 0;
            deltaHistory.forEach((delta: number) => {
                deltaAvg += delta;
            });
            deltaAvg /= deltaHistory.length;
            DebugWindowHtmlHandler.Instance.Fps = (1000 / deltaAvg).toPrecision(2).toString();
        }, ClientConfig.TICKRATE);
    }

    private updateGame(data) {
        if(data['update'] == null) {
            return
        }

        let update = data['update'].split('$');
        //console.log(update);
        for (let object in update) {
            let splitObject: string[] = update[object].split('=');
            let id: string = splitObject[0];
            let data: string = splitObject[1];

            let gameObject: GameObject = null;
            if(id[0] == '!') {
                id = id.slice(1);
                gameObject = this.netObjectMenager.getObject(id);
                if(gameObject) {
                    gameObject.destroy();
                }
                continue;
            }

            gameObject = this.netObjectMenager.getObject(id);

            if(gameObject == null) {
                gameObject = ObjectsFactory.CreateGameObject(id, data);
            }
            gameObject.deserialize(data.split('#'));
        }
    }
}