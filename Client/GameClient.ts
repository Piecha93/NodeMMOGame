/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Game} from "../Common/Game";
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
import {InputSnapshot} from "../Common/input/InputSnapshot";
import {Player} from "../Common/utils/game/Player";

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
            console.log("XDDDDDDDDDDDDD");
            this.inputHandler = new InputHandler();
            this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));
            // this.inputHandler.addSnapshotCallback((id:number, snapshot: InputSnapshot) => {
            //     if(this.player) {
            //         this.player.setInput(snapshot.Commands);
            //     }
            // });

            ObjectsFactory.HolderSubscribers.push(this.renderer);
            ObjectsFactory.HolderSubscribers.push(this.game);
            ObjectsFactory.HolderSubscribers.push(this.netObjectMenager);

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

            this.heartBeatSender.startSendingHeartbeats();
        });
        this.socket.on(SocketMsgs.UPDATE_GAME, this.updateGame.bind(this));
    }

    private startGame() {
            this.game.startGameLoop();

            let timer: DeltaTimer = new DeltaTimer;
            setInterval(() => {
                let delta: number = timer.getDelta();
                DebugWindowHtmlHandler.Instance.Fps = (1000 / delta).toPrecision(2).toString();
                this.game.update(delta);
                this.renderer.update();
            }, 15);
    }

    private updateGame(data) {
        if(data['update'] == null) {
            return
        }

        let update = data['update'].split('$');
        //console.log(update);
        for (let object in update) {
            let splitObject: string[] = update[object].split('-');
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
                gameObject = ObjectsFactory.CreateGameObject(id);
            }
            gameObject.deserialize(data.split('#'));
        }
    }
}