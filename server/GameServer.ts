import Socket = SocketIOClient.Socket;

import {ServerClient} from "./ServerClient";
import {Game} from "../Common/Game";
import {Transform} from "../Common/utils/game/Transform";
import {Player} from "../Common/utils/game/Player";
import {InputSnapshot} from "../Common/input/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {GameObject} from "../Common/utils/game/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../Common/net/SocketMsgs";
import {ObjectsFactory} from "../Common/utils/game/ObjectsFactory";
import {DeltaTimer} from "../Common/DeltaTimer";

export class GameServer {
    private sockets: SocketIO.Server;
    private clientsMap: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();

    private game: Game;
    private nameCounter: number = 0;

    private destroyedObjects: string = '';

    constructor(sockets: SocketIO.Server) {
        this.sockets = sockets;
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        this.game = new Game;

        ObjectsFactory.HolderSubscribers.push(this.game);
        ObjectsFactory.HolderSubscribers.push(NetObjectsManager.Instance);
        ObjectsFactory.DestroySubscribers.push((id: string) => {
            this.destroyedObjects += '$' + '!' + id;
        });


        let timer: DeltaTimer = new DeltaTimer;
        setInterval(() => {
            let delta: number = timer.getDelta();
            this.game.update(delta)
        }, 15);
    }

    private configureSockets() {
        this.sockets.on('connection', (socket: Socket) => {
            let clientName: string = "Guest " + this.nameCounter.toString();
            this.nameCounter++;

            let serverClient: ServerClient = new ServerClient(clientName, socket);
            this.clientsMap.set(socket, serverClient);

            //  console.log(this.clientsMap.size);

            socket.emit(SocketMsgs.START_GAME);
            
            socket.on(SocketMsgs.CLIENT_READY, () => {
                let player: Player = ObjectsFactory.CreateGameObject("P") as Player;
                player.Transform.X = Math.floor(Math.random() * 800);
                player.Transform.Y = Math.floor(Math.random() * 600);

                player.Name = clientName;

                serverClient.PlayerId = player.ID;

                let update: string = NetObjectsManager.Instance.collectUpdate(true);

                socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID, update: update });
                player.forceCompleteUpdate();
                serverClient.IsReady = true;
            });

            socket.on(SocketMsgs.INPUT_SNAPSHOT, (data) => {
                let player: Player = this.game.getGameObject(serverClient.PlayerId) as Player;
                if(player == null) {
                    return;
                }

                let snapshotId: number = parseInt(data['id']);
                let snapshot: InputSnapshot = new InputSnapshot();
                snapshot.deserialize(data['serializedSnapshot']);

                player.setInput(snapshot.Commands);
            });

            socket.on(SocketMsgs.HEARTBEAT, (data: number) => {
                if(this.clientsMap.has(socket)) {
                    this.clientsMap.get(socket).LastHbInterval = ServerConfig.CLIENT_TIMEOUT;
                    socket.emit(SocketMsgs.HEARTBEAT_RESPONSE, data);
                }
            });

            socket.on(SocketMsgs.CHAT_MESSAGE, (msg: string) => {
                if(this.clientsMap.has(socket)) {
                    if (msg == "rudycwel") {
                        this.game.getGameObject(serverClient.PlayerId).SpriteName = "dyzma";
                        return;
                    } else if (msg == "pandaxd") {
                        this.game.getGameObject(serverClient.PlayerId).SpriteName = "panda";
                        return;
                    }
                    this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: clientName, m: msg});
                }
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
        }, ServerConfig.DISCONNECT_CHECK_INTERVAL);

        setInterval(() => {
            let update: string = NetObjectsManager.Instance.collectUpdate();
            update += this.destroyedObjects;
            this.destroyedObjects = '';

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
        }, ServerConfig.UPDATE_INTERVAL);
    }

    private clientDisconnected(client: ServerClient) {
        console.log('player disconnected' + client.Name);

        let gameObject: GameObject = NetObjectsManager.Instance.getGameObject(client.PlayerId);
        if(gameObject != null) {
            gameObject.destroy();
        }
        this.clientsMap.delete(client.Socket);
    }
}

