/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Game} from "../Common/Game";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./InputHandler";
import {Player} from "../Common/utils/Player";
import {Position} from "../Common/utils/Position";
import {InputSnapshot} from "../Common/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {GameObject} from "../Common/utils/GameObject";
import {NetObject} from "../Common/net/NetObject";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private game: Game;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private inputTtimeoutId: NodeJS.Timer;

    constructor() {
        this.game = new Game;
        this.renderer = new Renderer(() => {
            this.inputHandler = new InputHandler(this.renderer.PhaserInput);
            this.socket.emit('clientready');
        });
    }

    connect() {
        this.socket = io.connect();

        if(this.socket != null) {
            this.configureSocket();
        }
    }

    private configureSocket() {
        this.socket.on('startgame', this.startGame.bind(this));
        this.socket.on('initializegame', this.initializeGame.bind(this));
        this.startSendingInput();
    }

    private startGame() {
        this.game = new Game;
      //  this.game.startGameLoop();
    }

    private startSendingInput() {
        this.inputTtimeoutId = setTimeout(() =>
            this.startSendingInput() , 1 / 10 * 1000);
            if (this.inputHandler.Changed) {
                let snapshot: InputSnapshot = this.inputHandler.cloneInputSnapshot();
                let serializedSnapshot = JSON.stringify(snapshot);

                this.socket.emit('inputsnapshot', serializedSnapshot);
            }
    }

    private initializeGame(initData) {
        if(initData['objects'] == null) {
            return
        }
        let update = initData['objects'].split('$');
        for (let object in update) {
            let splitObject: string[] = update[object].split('-');
            let id: number = parseInt(splitObject[0]);
            let data: string = splitObject[1];

            let netObject: NetObject = NetObjectsManager.Instance.getObject(id);
            if(netObject == null) {
                let gameObject = new Player();
                netObject = NetObjectsManager.Instance.createObject(gameObject, id);

                this.renderer.addGameObject(gameObject);
            }
            console.log(data);
            netObject.GameObject.deserialize(data.split('#'))
        }

        this.renderer.update();
    }
}