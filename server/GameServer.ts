import Socket = SocketIOClient.Socket;

import {ServerClient} from "./ServerClient";
import {World} from "../Common/World";
import {Player} from "../Common/utils/game/Player";
import {InputSnapshot} from "../Common/input/InputSnapshot";
import {NetObjectsManager} from "../Common/net/NetObjectsManager";
import {GameObject} from "../Common/utils/game/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../Common/net/SocketMsgs";
import {ObjectsFactory} from "../Common/utils/game/ObjectsFactory";
import {DeltaTimer} from "../Common/DeltaTimer";
import {Obstacle} from "../Common/utils/game/Obstacle";
import Session = Express.Session;
import {Database, IUserModel} from "./database/Database";

export class GameServer {
    private sockets: SocketIO.Server;
    private clients: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();
    private socketsIds: Map<string, Socket> = new Map<string, Socket>();

    private world: World;

    private destroyedObjects: string = '';

    constructor(sockets: SocketIO.Server) {
        this.sockets = sockets;
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        this.world = new World(2048, 1156);

        ObjectsFactory.HolderSubscribers.push(this.world);
        ObjectsFactory.HolderSubscribers.push(NetObjectsManager.Instance);
        ObjectsFactory.DestroySubscribers.push((id: string) => {
            this.destroyedObjects += '$' + '!' + id;
        });

        //////////////////////////////////////////////////////TEST (CREATE WALLS AROUND MAP)
        for(let i = 0; i < 1156 / 32; i++) {
            let o: Obstacle = ObjectsFactory.CreateGameObject("O") as Obstacle;
            o.Transform.X = 0;
            o.Transform.Y = i * 32;

            o = ObjectsFactory.CreateGameObject("O") as Obstacle;
            o.Transform.X = 2048 - 32;
            o.Transform.Y = i * 32;
        }

        for(let i = 1; i < 2016 / 32; i++) {
            let o: Obstacle = ObjectsFactory.CreateGameObject("O") as Obstacle;
            o.Transform.X = i * 32;
            o.Transform.Y = 0;

            o = ObjectsFactory.CreateGameObject("O") as Obstacle;
            o.Transform.X = i * 32;
            o.Transform.Y = 1156 - 32;
        }
        let o: Obstacle = ObjectsFactory.CreateGameObject("O") as Obstacle;
        o.Transform.X = 150;
        o.Transform.Y = 150;
        o.Transform.Width = 150;
        ///////////////////////////////////////////////////////////////////TEST

        let timer: DeltaTimer = new DeltaTimer;
        setInterval(() => {
            let delta: number = timer.getDelta();
            this.world.update(delta)
        }, ServerConfig.TICKRATE);
    }

    private configureSockets() {
        this.sockets.on('connection', (socket: Socket) => {
            let socketSession = (socket as any).request.session;

            if(this.socketsIds.has(socketSession.user_id)) {
                let client: ServerClient = this.clients.get(this.socketsIds.get(socketSession.user_id));
                this.clientDisconnected(client, "You connected from other browser");
                this.socketsIds.delete(socketSession.user_id);
            }

            let serverClient: ServerClient = new ServerClient(socket);
            this.clients.set(socket, serverClient);
            this.socketsIds.set(socketSession.user_id, socket);

            let clientName: string = "";
            if(socketSession.user_id.substring(0, 5) == "Guest") {
                clientName = socketSession.user_id;
            } else {
                Database.Instance.findUserById(socketSession.user_id, (user: IUserModel) => {
                    clientName = user.username;
                    let player: Player = this.world.getGameObject(serverClient.PlayerId) as Player;
                    if(player) {
                        player.Name =  clientName;
                    }
                })
            }

            socket.on(SocketMsgs.CLIENT_READY, () => {
                let player: Player = ObjectsFactory.CreateGameObject("P") as Player;
                player.Transform.X = Math.floor(Math.random() * (this.world.Width - 100)) + 50;
                player.Transform.Y = Math.floor(Math.random() * (this.world.Height - 100) + 50);

                player.Name = clientName;

                serverClient.PlayerId = player.ID;

                let update: string = NetObjectsManager.Instance.collectUpdate(true);
                let world: string = this.world.serialize();

                socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID, update: update, world: world });
                player.forceCompleteUpdate();
                serverClient.IsReady = true;
            });

            socket.on(SocketMsgs.INPUT_SNAPSHOT, (data) => {
                let player: Player = this.world.getGameObject(serverClient.PlayerId) as Player;
                if(player == null) {
                    return;
                }

                let snapshotId: number = parseInt(data['id']);
                let snapshot: InputSnapshot = new InputSnapshot();
                snapshot.deserialize(data['serializedSnapshot']);

                player.setInput(snapshot.Commands);
            });

            socket.on(SocketMsgs.HEARTBEAT, (data: number) => {
                if(this.clients.has(socket)) {
                    this.clients.get(socket).LastHbInterval = ServerConfig.CLIENT_TIMEOUT;
                    socket.emit(SocketMsgs.HEARTBEAT_RESPONSE, data);
                }
            });

            socket.on(SocketMsgs.CHAT_MESSAGE, (msg: string) => {
                if(this.clients.has(socket)) {
                    if (msg == "rudycwel") {
                        this.world.getGameObject(serverClient.PlayerId).SpriteName = "dyzma";
                        return;
                    } else if (msg == "pandaxd") {
                        this.world.getGameObject(serverClient.PlayerId).SpriteName = "panda";
                        return;
                    } else if (msg == "kamis :*") {
                        this.world.getGameObject(serverClient.PlayerId).SpriteName = "kamis";
                        return;
                    }
                    this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: clientName, m: msg});
                }
            });

            socket.on('disconnect', () => {
                this.clientDisconnected(this.clients.get(socket));
            });
        });

        setInterval(() => {
            this.clients.forEach((client: ServerClient) => {
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
                this.clients.forEach((client: ServerClient) => {
                    if (client.IsReady) {
                        client.Socket.emit(SocketMsgs.UPDATE_GAME, {update});
                    }
                });
            }
        }, ServerConfig.UPDATE_INTERVAL);
    }

    private clientDisconnected(client: ServerClient, reason?: string) {
        if(!client) return;

        if(reason) {
            client.Socket.emit(reason);
        }

        console.log(SocketMsgs.ERROR, 'player disconnected' + client.Name);

        let gameObject: GameObject = NetObjectsManager.Instance.getGameObject(client.PlayerId);
        if(gameObject != null) {
            gameObject.destroy();
        }
        this.clients.delete(client.Socket);
    }
}

