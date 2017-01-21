import * as io from 'socket.io-client'
import {Game} from "../Common/Game";

export class GameClient {
    private socket: SocketIOClient.Socket;
    private game: Game;

    constructor() {
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