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
import {Enemy} from "../Common/utils/game/Enemy";
import * as LZString from "lz-string";

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

        ObjectsFactory.ObjectHolderSubscribers.push(this.world);
        ObjectsFactory.ObjectHolderSubscribers.push(NetObjectsManager.Instance);
        ObjectsFactory.DestroyCallbacks.push((id: string) => {
            this.destroyedObjects += '$' + '!' + id;
        });

        ////////////////////////////////////////////////////TEST (CREATE WALLS AROUND MAP)
        for(let i = 0; i < 1156 / 32; i++) {
            let o: Obstacle = ObjectsFactory.CreateGameObject(Obstacle) as Obstacle;
            o.Transform.X = 0;
            o.Transform.Y = i * 32;

            o = ObjectsFactory.CreateGameObject(Obstacle) as Obstacle;
            o.Transform.X = 2048 - 32;
            o.Transform.Y = i * 32;
        }

        for(let i = 1; i < 2016 / 32; i++) {
            let o: Obstacle = ObjectsFactory.CreateGameObject(Obstacle) as Obstacle;
            o.Transform.X = i * 32;
            o.Transform.Y = 0;

            o = ObjectsFactory.CreateGameObject(Obstacle) as Obstacle;
            o.Transform.X = i * 32;
            o.Transform.Y = 1156 - 32;
        }
        let o: Obstacle = ObjectsFactory.CreateGameObject(Obstacle) as Obstacle;
        o.Transform.X = 150;
        o.Transform.Y = 150;
        o.Transform.Width = 150;

        let createEnemy: Function = () => {
            let e: Enemy = ObjectsFactory.CreateGameObject(Enemy) as Enemy;
            e.Transform.X = Math.floor(Math.random() * (this.world.Width - 100)) + 50;
            e.Transform.Y = Math.floor(Math.random() * (this.world.Height - 100) + 50);

            e.Name = "Monster";

            e.addDestroyListener(() => {
                createEnemy();
            })
        };

        for(let i = 0; i < 100; i++) {
            createEnemy();
        }
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

            if(socketSession.user_id.substring(0, 5) == "Guest") {
                serverClient.Name = socketSession.user_id;
            } else {
                Database.Instance.findUserById(socketSession.user_id, (user: IUserModel) => {
                    serverClient.Name = user.username;
                    let player: Player = this.world.getGameObject(serverClient.PlayerId) as Player;
                    if(player) {
                        player.Name = serverClient.Name;
                    }
                })
            }

            socket.on(SocketMsgs.CLIENT_READY, () => {
                let player: Player = ObjectsFactory.CreateGameObject(Player) as Player;
                player.Transform.X = Math.floor(Math.random() * (this.world.Width - 100)) + 50;
                player.Transform.Y = Math.floor(Math.random() * (this.world.Height - 100) + 50);

                player.Name = serverClient.Name;

                serverClient.PlayerId = player.ID;

                let update: string = LZString.compressToUTF16(NetObjectsManager.Instance.collectUpdate(true));
                let world: string = this.world.serialize();
                socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID, update: update, world: world });
                player.forceCompleteUpdate();
                serverClient.IsReady = true;

                this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: player.Name + " has joined game"});
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
                    this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: serverClient.Name, m: msg});
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
                update = LZString.compressToUTF16(update);
                this.clients.forEach((client: ServerClient) => {
                    if (client.IsReady) {
                        client.Socket.emit(SocketMsgs.UPDATE_GAME, update);
                    }
                });
            }
        }, ServerConfig.UPDATE_INTERVAL);
    }

    private clientDisconnected(client: ServerClient, reason?: string) {
        if(!client) return;

        if(reason) {
            client.Socket.emit(SocketMsgs.ERROR, reason);
        }

        console.log('player disconnected' + client.Name + " due " + reason);
        this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: client.Name + " has left game"});


        let gameObject: GameObject = NetObjectsManager.Instance.getGameObject(client.PlayerId);
        if(gameObject != null) {
            gameObject.destroy();
        }
        this.clients.delete(client.Socket);
    }
}

