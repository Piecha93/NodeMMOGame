import Socket = SocketIOClient.Socket;

import {ServerClient} from "./ServerClient";
import {Game} from "../Common/Game";
import {Position} from "../Client/utils/Position";
import {Player} from "../Client/utils/Player";

export class GameServer {
    private sockets: SocketIO.Server;
    private clientsMap: Map<string, ServerClient> = new Map<string, ServerClient>();

    private game: Game;

    private nameCounter: number = 0;

    constructor(sockets: any) {
        this.sockets = sockets;
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        this.game = new Game;
        this.game.startGameLoop();
    }

    private configureSockets() {
        this.sockets.on('connection', (socket: Socket) => {
            let clientName: string = "Guest " + this.nameCounter.toString();
            this.nameCounter++;

            let serverClient: ServerClient = new ServerClient(clientName, socket);
            this.clientsMap.set(clientName, serverClient);

            socket.emit('startgame');

            socket.on('clientready', () => {
                let x: number = Math.floor(Math.random() * 800);
                let y: number = Math.floor(Math.random() * 600);
                let player: Player =  this.game.addPlayer(clientName, new Position(10, 50));

                socket.emit('initializegame', {name: clientName, x: x, y: y});
            });
        });
    }

}

