/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Game} from "../Common/Game";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./input/InputHandler";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {NetObject} from "../Common/net/NetObject";
import {ObjectsFactory} from "../Common/utils/ObjectsFactory";
import {HeartBeatSender} from "./net/HeartBeatSender";
import {GameObject} from "../Common/utils/GameObject";
import {SocketMsgs} from "../Common/net/SocketMsgs";
import {InputSnapshot} from "../Common/input/InputSnapshot";
import {Chat} from "./Chat";
import {InputSender} from "../Client/net/InputSender";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private game: Game;
    private chat: Chat;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private heartBeatSender: HeartBeatSender;
    private inputSender: InputSender;
    private netObjectMenager: NetObjectsManager = NetObjectsManager.Instance;

    constructor() {
        this.connect();
        this.game = new Game;
        this.inputSender = new InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender(this.socket);
        this.chat = new Chat(this.socket);

        this.renderer = new Renderer(() => {
            this.inputHandler = new InputHandler(this.renderer.PhaserInput);
            this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));

            this.socket.emit(SocketMsgs.CLIENT_READY);

            this.inputHandler.startInputSnapshotTimer();
            this.heartBeatSender.startSendingHeartbeats();

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
        });
        this.socket.on(SocketMsgs.UPDATE_GAME, this.updateGame.bind(this));
    }

    private startGame() {
        this.game = new Game;
        this.game.startGameLoop();
    }

    private updateGame(data) {
        if(data['update'] == null) {
            return
        }

        //console.log(data['update']);

        let update = data['update'].split('$');
        for (let object in update) {
            let splitObject: string[] = update[object].split('-');
            let id: string = splitObject[0];
            let data: string = splitObject[1];
            if(id[0] == '!') {
                id = id.slice(1);
                if(this.netObjectMenager.has(id)) {
                    let gameObject: GameObject = this.netObjectMenager.getObject(id).GameObject;
                    this.renderer.removeGameObject(gameObject);
                    this.game.removeObject(gameObject.ID);
                    this.netObjectMenager.removeObject(id);
                }
                continue;
            }

            let netObject: NetObject = this.netObjectMenager.getObject(id);
            if(netObject == null) {
                let gameObject = ObjectsFactory.CreateGameObject(id);
                netObject = this.netObjectMenager.createObject(gameObject, id);

                this.renderer.addGameObject(gameObject, id[0]);
            }
            netObject.GameObject.deserialize(data.split('#'))
        }
        this.renderer.update();
    }
}