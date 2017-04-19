import Socket = SocketIOClient.Socket;

import {ServerClient} from "./ServerClient";
import {Game} from "../Common/Game";
import {Position} from "../Common/utils/Position";
import {Player} from "../Common/utils/Player";
import {InputSnapshot} from "../Common/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {NetObject} from "../Common/net/NetObject";
import {GameObject} from "../Common/utils/GameObject";
import {ServerSettings} from "./ServerSettings";

//cr - client ready
//sg - start game
//ig - initialize game
//hb - heartbeat
//hbr - heartbeat response
//ug - update game

export class GameServer {
    private socket: SocketIO.Server;
    private clientsMap: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();

    private game: Game;
    private nameCounter: number = 0;

    private disconnectedClients: string = '';

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

                serverClient.NetObjectId = NetObjectsManager.Instance.createObject(player).ID;
                serverClient.PlayerId = player.ID;

                let objects: string = NetObjectsManager.Instance.collectUpdate();

                socket.emit('ig', { objects });
                serverClient.IsReady = true;
            });

            socket.on('is', (data) => {
                let deserializedData = JSON.parse(data);
                let snapshot: InputSnapshot = new InputSnapshot().deserialize(deserializedData);

                let player: Player = this.game.getObject(serverClient.PlayerId) as Player;
                player.Destination = snapshot.ClickPosition;

                console.log(player.Destination);
            });

            socket.on('hb', (data: number) => {
                this.clientsMap.get(socket).LastHbInterval = ServerSettings.CLIENT_TIMEOUT;
                socket.emit('hbr', data);
            })
        });

        setInterval(() => {
            this.clientsMap.forEach((client: ServerClient, socket: Socket) => {
                client.LastHbInterval -= 1000;
                if (client.LastHbInterval <= 0) {
                    console.log('player disconnected' + client.Name);
                    this.disconnectedClients += '$' + '!' + client.NetObjectId;

                    NetObjectsManager.Instance.removeObject(client.NetObjectId);
                    this.game.removeObject(client.PlayerId);
                    this.clientsMap.delete(socket);
                }
            });
        }, ServerSettings.DISCONNECT_CHECK_INTERVAL);

        setInterval(() => {
            let update: string = NetObjectsManager.Instance.collectUpdate();
            update += this.disconnectedClients;
            this.disconnectedClients = '';

            this.clientsMap.forEach( (client: ServerClient, socket: Socket) => {
                 if(client.IsReady) {
                     socket.emit('ug', { update });
                }
            });
        }, ServerSettings.UPDATE_INTERVAL);
    }

}

