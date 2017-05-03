import Socket = SocketIOClient.Socket;

import {ServerClient} from "./ServerClient";
import {Game} from "../Common/Game";
import {Position} from "../Common/utils/Position";
import {Player} from "../Common/utils/Player";
import {InputSnapshot} from "../Common/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {GameObject} from "../Common/utils/GameObject";
import {ServerSettings} from "./ServerSettings";
import {SocketMsgs} from "../Common/net/SocketMsgs";

export class GameServer {
    private socket: SocketIO.Server;
    private clientsMap: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();

    private game: Game;
    private nameCounter: number = 0;

    private disconnectedClients: string = '';

    constructor(sockets: SocketIO.Server) {
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

            //console.log(this.clientsMap.size);

            socket.emit(SocketMsgs.START_GAME);
            
            socket.on(SocketMsgs.CLIENT_READY, () => {
                let x: number = Math.floor(Math.random() * 800);
                let y: number = Math.floor(Math.random() * 600);

                let player: GameObject = this.game.spawnPlayer(clientName, new Position(x, y));

                serverClient.NetObjectId = NetObjectsManager.Instance.createObject(player).ID;
                serverClient.PlayerId = player.ID;

                let update: string = NetObjectsManager.Instance.collectUpdate(true);

                socket.emit(SocketMsgs.INITIALIZE_GAME, { update });
                player.forceCompleteUpdate();
                serverClient.IsReady = true;
            });

            socket.on(SocketMsgs.INPUT_SNAPSHOT, (data) => {
                //console.log(data);
                let deserializedData = JSON.parse(data);
                let snapshot: InputSnapshot = new InputSnapshot().deserialize(deserializedData);

                let player: Player = this.game.getObject(serverClient.PlayerId) as Player;
                if(player != null) {
                    player.Destination = snapshot.ClickPosition;
                }
            });

            socket.on(SocketMsgs.HEARTBEAT, (data: number) => {
                this.clientsMap.get(socket).LastHbInterval = ServerSettings.CLIENT_TIMEOUT;
                socket.emit(SocketMsgs.HEARTBEAT_RESPONSE, data);
            });

            socket.on(SocketMsgs.CHAT_MESSAGE, (msg: string) => {
                this.socket.emit(SocketMsgs.CHAT_MESSAGE, {s: clientName, m: msg});
            });

            socket.on('disconnect', () => {
                if(this.clientsMap.has(socket)) {
                    this.clientDisconnected(this.clientsMap.get(socket));
                }
            });
        });

        setInterval(() => {
            this.clientsMap.forEach((client: ServerClient, socket: Socket) => {
                client.LastHbInterval -= 1000;
                if (client.LastHbInterval <= 0) {
                    this.clientDisconnected(client);
                }
            });
        }, ServerSettings.DISCONNECT_CHECK_INTERVAL);

        setInterval(() => {
            let update: string = NetObjectsManager.Instance.collectUpdate();
            update += this.disconnectedClients;
            this.disconnectedClients = '';

            if(update[0] == "$") {
                update = update.slice(1);
            }

            if(update != '') {
                this.clientsMap.forEach((client: ServerClient, socket: Socket) => {
                    if (client.IsReady) {
                        socket.emit(SocketMsgs.UPDATE_GAME, {update});
                    }
                });
            }
        }, ServerSettings.UPDATE_INTERVAL);
    }

    private clientDisconnected(client: ServerClient) {
        console.log('player disconnected' + client.Name);
        this.disconnectedClients += '$' + '!' + client.NetObjectId;

        NetObjectsManager.Instance.removeObject(client.NetObjectId);
        this.game.removeObject(client.PlayerId);
        this.clientsMap.delete(client.Socket);
    }
}

