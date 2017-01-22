import * as io from 'socket.io-client'
import {Game} from "../Common/Game";
import {Renderer} from "./graphic/Renderer";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private game: Game;
    private renderer: Renderer;

    constructor() {
        this.renderer = new Renderer;
    }

    connect() {
        this.socket = io.connect();

        if(this.socket != null) {
            this.configureSocket();
        }
    }

    private configureSocket() {
        this.socket.on('startgame', this.startGame);
    }

    public startGame() {
        this.game = new Game;
    }
}