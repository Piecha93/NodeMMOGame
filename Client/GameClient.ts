/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />

import {Game} from "../Common/Game";
import {Renderer} from "./graphic/Renderer";
import {InputHandler, InputSnapshot} from "./InputHandler";
import {Player} from "./utils/Player";
import {Position} from "./utils/Position";

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
        this.game.startGameLoop();
    }

    private initializeGame(initData) {
        let player: Player = this.game.addPlayer(initData.name, new Position(initData.x, initData.y));
        this.renderer.addGameObject(player);
        this.renderer.update();
    }
}