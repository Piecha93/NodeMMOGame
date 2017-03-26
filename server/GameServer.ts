import Socket = SocketIOClient.Socket;

import {ServerClient} from "./ServerClient";
import {Game} from "../Common/Game";
import {Position} from "../Common/utils/Position";
import {Player} from "../Common/utils/Player";
import {InputSnapshot} from "../Common/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {NetObject} from "../Common/net/NetObject";
import {GameObject} from "../Common/utils/GameObject";

export class GameServer {
    private socket: SocketIO.Server;
    private clientsMap: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();

    private game: Game;

    private nameCounter: number = 0;

    constructor(sockets: any) {
        this.socket = sockets;
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
        this.socket.on('connection', (socket: Socket) => {
            let clientName: string = "Guest " + this.nameCounter.toString();
            this.nameCounter++;

            let serverClient: ServerClient = new ServerClient(clientName, socket);
            this.clientsMap.set(socket, serverClient);

            socket.emit('startgame');

            socket.on('clientready', () => {
                let x: number = Math.floor(Math.random() * 800);
                let y: number = Math.floor(Math.random() * 600);

                let player: GameObject = this.game.spawnPlayer(clientName, new Position(x, y));

                let netObject: NetObject = new NetObject(clientName, player);
                NetObjectsManager.Instance.addObject(netObject);


                let setializedObjects: string = NetObjectsManager.Instance.serializeNetObjects();

                socket.emit('initializegame', { objects: setializedObjects });
                serverClient.IsReady = true;

            });

            socket.on('inputsnapshot', (data) => {
                let deserializedData = JSON.parse(data);
                let snapshot: InputSnapshot = new InputSnapshot().deserialize(deserializedData);

                let player: Player = this.game.getPlayer(clientName);
                player.Destination = snapshot.ClickPosition;

                console.log(player.Destination);
            });
        });

        setInterval(() => {
            let setializedObjects: string = NetObjectsManager.Instance.serializeNetObjects();

            this.clientsMap.forEach( (client: ServerClient, socket: Socket) => {
                if(client.IsReady) {
                    client.Socket.emit('initializegame', { objects: setializedObjects });
                    console.log(setializedObjects)
                }
            });
        }, 100);
    }

}

