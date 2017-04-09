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

            socket.emit('sg');

            socket.on('cr', () => {
                let x: number = Math.floor(Math.random() * 800);
                let y: number = Math.floor(Math.random() * 600);

                let player: GameObject = this.game.spawnPlayer(clientName, new Position(x, y));

                NetObjectsManager.Instance.createObject(player);


                let objects: string = NetObjectsManager.Instance.collectUpdate();

                socket.emit('ig', { objects: objects });
                serverClient.IsReady = true;
            });

            socket.on('is', (data) => {
                let deserializedData = JSON.parse(data);
                let snapshot: InputSnapshot = new InputSnapshot().deserialize(deserializedData);

                let player: Player = this.game.getPlayer(clientName);
                player.Destination = snapshot.ClickPosition;

                console.log(player.Destination);
            });

            socket.on('hb', (data: number) => {
                this.clientsMap.get(socket).LastHbInterval = 0;
                socket.emit('hbr', data);
            })
        });

        setInterval(() => {
            //let objects: string = NetObjectsManager.Instance.serializeNetObjects();
            let objects: string = NetObjectsManager.Instance.collectUpdate();

            this.clientsMap.forEach( (client: ServerClient, socket: Socket) => {
                if(client.IsReady) {
                    client.Socket.emit('ug', { objects });
                }
            });
        }, 50);
    }

}

