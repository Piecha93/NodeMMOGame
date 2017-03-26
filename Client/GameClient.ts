/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Game} from "../Common/Game";
import {Renderer} from "./graphic/Renderer";
import {InputHandler} from "./InputHandler";
import {Player} from "../Common/utils/Player";
import {Position} from "../Common/utils/Position";
import {InputSnapshot} from "../Common/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {GameObject} from "../Common/utils/GameObject";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private game: Game;
    private renderer: Renderer;
    private inputHandler: InputHandler;

    constructor() {
        this.game = new Game;
        this.renderer = new Renderer(() => {
            this.inputHandler = new InputHandler(this.renderer.PhaserInput);
            this.socket.emit('clientready');
        });

        // TEST
        setInterval(() => {
            if (this.inputHandler.Changed) {
                let snapshot: InputSnapshot = this.inputHandler.cloneInputSnapshot();
                let serializedSnapshot = JSON.stringify(snapshot);

                this.socket.emit('inputsnapshot', serializedSnapshot);
            }
        }, 100);
        // /TEST
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
    }

    private startGame() {
        this.game = new Game;
      //  this.game.startGameLoop();
    }

    private initializeGame(initData) {
        let deserializedObjects = JSON.parse(initData.objects);
        for (let object in deserializedObjects) {
            if (deserializedObjects.hasOwnProperty(object)) {
                let gameObject: GameObject = NetObjectsManager.Instance.updateObject(deserializedObjects[object]);
                if(gameObject) {
                    this.renderer.addGameObject(gameObject);
                }
            }
        }
        console.log(initData);
            this.renderer.update();
        // let player: Player = this.game.spawn(initData.name, new Position(initData.x, initData.y));
        // this.renderer.addGameObject(player);
        // this.renderer.update();
    }
}