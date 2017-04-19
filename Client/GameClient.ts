/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Game} from "../Common/Game";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./InputHandler";
import {InputSnapshot} from "../Common/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {NetObject} from "../Common/net/NetObject";
import GameObjectFactory = Phaser.GameObjectFactory;
import {ObjectsFactory} from "../Common/utils/ObjectsFactory";
import {HeartBeatSender} from "./HeartBeatSender";
import {GameObject} from "../Common/utils/GameObject";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private game: Game;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private inputTtimeoutId: NodeJS.Timer;
    private heartBeatSender: HeartBeatSender;
    private netObjectMenager: NetObjectsManager = NetObjectsManager.Instance;

    constructor() {
        this.game = new Game;

        this.renderer = new Renderer(() => {
            this.inputHandler = new InputHandler(this.renderer.PhaserInput);
            this.socket.emit('cr');
            this.heartBeatSender.startSendingHeartbeats();
        });
    }

    connect() {
        this.socket = io.connect();
        this.heartBeatSender = new HeartBeatSender(this.socket);

        if(this.socket != null) {
            this.configureSocket();
        }
    }

    private configureSocket() {
        this.socket.on('sg', this.startGame.bind(this));
        this.socket.on('ig', this.initializeGame.bind(this));
        this.socket.on('ug', this.updateGame.bind(this));
    }

    private startGame() {
        this.game = new Game;
    }

    private startSendingInput() {
        this.inputTtimeoutId = setTimeout(() =>
            this.startSendingInput() , 1 / 10 * 1000);
            if (this.inputHandler.Changed) {
                let snapshot: InputSnapshot = this.inputHandler.cloneInputSnapshot();
                let serializedSnapshot = JSON.stringify(snapshot);

                this.socket.emit('is', serializedSnapshot);
            }
    }

    private initializeGame(initData) {
        if(initData['objects'] == null) {
            return
        }

        let update = initData['objects'].split('$');
        for (let object in update) {
            let splitObject: string[] = update[object].split('-');
            let id: string = splitObject[0];
            let data: string = splitObject[1];

            let netObject: NetObject = this.netObjectMenager.getObject(id);
            if(netObject == null) {
                let gameObject = ObjectsFactory.CreateGameObject(id);
                netObject = this.netObjectMenager.createObject(gameObject, id);

                this.renderer.addGameObject(gameObject);
            } else {
                netObject.GameObject.deserialize(data.split('#'))
            }
        }

        this.startSendingInput();
    }

    private updateGame(data) {
        if(data['update'] == null) {
            return
        }

        let update = data['update'].split('$');
        for (let object in update) {
            let splitObject: string[] = update[object].split('-');
            let id: string = splitObject[0];
            let data: string = splitObject[1];
            if(id[0] == '!') {
                console.log('removed' + id);
                id = id.slice(1);
                let gameObject: GameObject = this.netObjectMenager.getObject(id).GameObject;
                this.renderer.removeGameObject(gameObject);
                this.game.removeObject(gameObject.ID);
                this.netObjectMenager.removeObject(object[0]);
                continue;
            }

            let netObject: NetObject = this.netObjectMenager.getObject(id);
            if(netObject == null) {
                let gameObject = ObjectsFactory.CreateGameObject(id);
                netObject = this.netObjectMenager.createObject(gameObject, id);

                this.renderer.addGameObject(gameObject);
            } else {
                netObject.GameObject.deserialize(data.split('#'))
            }
        }
        this.renderer.update();
    }
}