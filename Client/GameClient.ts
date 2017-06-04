/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Game} from "../Common/Game";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./input/InputHandler";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {ObjectsFactory} from "../Common/utils/ObjectsFactory";
import {HeartBeatSender} from "./net/HeartBeatSender";
import {GameObject} from "../Common/utils/GameObject";
import {SocketMsgs} from "../Common/net/SocketMsgs";
import {Chat} from "./Chat";
import {InputSender} from "../Client/net/InputSender";
import {DeltaTimer} from "../Common/DeltaTimer";
import {DebugWindowHtmlHandler} from "./graphic/HtmlHandlers/DebugWindowHtmlHandler";
import {InputSnapshot} from "../Common/input/InputSnapshot";
import {Player} from "../Common/utils/Player";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private game: Game;
    private chat: Chat;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private heartBeatSender: HeartBeatSender;
    private inputSender: InputSender;
    private netObjectMenager: NetObjectsManager = NetObjectsManager.Instance;

    private player: Player = null;

    constructor() {
        this.connect();
        this.game = new Game;
        this.inputSender = new InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender(this.socket);
        this.chat = new Chat(this.socket);

        this.renderer = new Renderer(() => {
            this.inputHandler = new InputHandler(this.renderer.PhaserInput);
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
            this.updateGame(data);
            this.player = this.game.getGameObject(data['id']) as Player;

            console.log(this.player);

            this.inputHandler.startInputSnapshotTimer();
            this.heartBeatSender.startSendingHeartbeats();
        });
        this.socket.on(SocketMsgs.UPDATE_GAME, this.updateGame.bind(this));
    }

    private startGame() {
        this.game = new Game;
        this.game.startGameLoop();

        let timer: DeltaTimer = new DeltaTimer;
        setInterval(() => {
            DebugWindowHtmlHandler.Instance.Fps = (1000 / timer.getDelta()).toPrecision(2).toString();
            this.renderer.update();
        }, 33.33);
    }

    private updateGame(data) {
        if(data['update'] == null) {
            return
        }

        let update = data['update'].split('$');
        console.log(update);
        for (let object in update) {
            let splitObject: string[] = update[object].split('-');
            let id: string = splitObject[0];
            let data: string = splitObject[1];

            let gameObject: GameObject = this.netObjectMenager.getObject(id);

            if(id[0] == '!') {
                id = id.slice(1);
                if(this.netObjectMenager.has(id)) {

                    this.renderer.removeGameObject(gameObject);
                    gameObject.destroy();
                }
                continue;
            }

            if(gameObject == null) {
                console.log("create ");
                gameObject = ObjectsFactory.CreateGameObject(id);
                gameObject.ID = id;
                
                this.netObjectMenager.addGameObject(gameObject);
                this.game.addGameObject(gameObject);
                this.renderer.addGameObject(gameObject);
            }
            gameObject.deserialize(data.split('#'));
        }
    }
}