import Socket = SocketIOClient.Socket;

import {ServerClient} from "./ServerClient";
import {GameWorld} from "../common/GameWorld";
import {Player} from "../common/utils/game/Player";
import {InputSnapshot} from "../common/input/InputSnapshot";
import {NetObjectsManager} from "../common/net/NetObjectsManager";
import {GameObject} from "../common/utils/game/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../common/net/SocketMsgs";
import {GameObjectsFactory} from "../common/utils/game/ObjectsFactory";
import {DeltaTimer} from "../common/DeltaTimer";
import {Obstacle} from "../common/utils/game/Obstacle";
import {Database, IUserModel} from "./database/Database";
import {Enemy} from "../common/utils/game/Enemy";
import {Actor} from "../common/utils/game/Actor";
import {Transform} from "../common/utils/physics/Transform";
import {Item} from "../common/utils/game/Item";

const spawn = require('threads').spawn;

let compress = function (update, done) {
    const LZString = require("lz-string");
    done(LZString.compressToUTF16(update));
};

NetObjectsManager.Instance;

export class GameServer {
    private sockets: SocketIO.Server;
    private clients: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();
    private socketsIds: Map<string, Socket> = new Map<string, Socket>();

    private world: GameWorld;

    private sendAndCompressUpdateThread = spawn(compress);

    constructor(sockets: SocketIO.Server) {
        this.sockets = sockets;
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        this.world = new GameWorld(2048, 1156);

        // GameObjectsFactory.DestroyCallbacks.push((gameObject: GameObject) => {
        //     if(gameObject instanceof Actor) {
        //         this.sockets.emit(SocketMsgs.CHAT_MESSAGE,
        //             {s: "Server", m: (gameObject as Actor).Name + " has been slain"});
        //     }
        // });

        this.initTestObjects();

        this.startGameLoop();
    }

    updateResolution: number = 0;
    timer: DeltaTimer = new DeltaTimer;

    private startGameLoop() {
        let delta: number = this.timer.getDelta();
        this.world.update(delta);

        if(this.updateResolution++ % 5 == 0) {
            this.collectAndCompressUpdate(this.sendUpdate.bind(this));
        }
        setTimeout(() => {
            this.startGameLoop();
        }, ServerConfig.TICKRATE);
    }

    private configureSockets() {
        this.sockets.on(SocketMsgs.CONNECTION, (socket: Socket) => {
            let socketSession = (socket as any).request.session;

            if(this.socketsIds.has(socketSession.user_id)) {
                let client: ServerClient = this.clients.get(this.socketsIds.get(socketSession.user_id));
                this.clientDisconnected(client, "You have connected from another browser");
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
                let player: Player = GameObjectsFactory.Instatiate("Player") as Player;
                player.Transform.X = Math.floor(Math.random() * (this.world.Width - 100)) + 50;
                player.Transform.Y = Math.floor(Math.random() * (this.world.Height - 100) + 50);

                player.Name = serverClient.Name;

                serverClient.PlayerId = player.ID;

                // let update: string = LZString.compressToUTF16(NetObjectsManager.Instance.collectUpdate(true));
                this.collectAndCompressUpdate((update) => {
                    let world: string = this.world.serialize();
                    socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID, update: update, world: world });
                    player.forceCompleteUpdate();
                    serverClient.IsReady = true;

                    this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: player.Name + " has joined game"});
                }, true);
            });

            socket.on(SocketMsgs.INPUT_SNAPSHOT, (data) => {
                let player: Player = this.world.getGameObject(serverClient.PlayerId) as Player;
                if(player == null) {
                    return;
                }

                let snapshot: InputSnapshot = new InputSnapshot();
                snapshot.deserialize(data);
                player.setInput(snapshot);
            });

            socket.on(SocketMsgs.HEARTBEAT, (data: number) => {
                if(this.clients.has(socket)) {
                    this.clients.get(socket).LastHbInterval = ServerConfig.CLIENT_TIMEOUT;
                    socket.emit(SocketMsgs.HEARTBEAT_RESPONSE, data);
                }
            });

            socket.on(SocketMsgs.CHAT_MESSAGE, (msg: string) => {
                if(this.clients.has(socket)) {
                    this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: serverClient.Name, m: msg});
                }
            });

            socket.on(SocketMsgs.DISCONNECT, () => {
                this.clientDisconnected(this.clients.get(socket), "disconnected");
            });
        });

        setInterval(() => {
            this.clients.forEach((client: ServerClient) => {
                client.LastHbInterval -= 1000;
                if (client.LastHbInterval <= 0) {
                    this.clientDisconnected(client, "timeout");
                }
            });
        }, ServerConfig.DISCONNECT_CHECK_INTERVAL);
    }

    private bandwithHistory: Array<number> = [];

    private calculateAverageBandwith(updateSize): number {
        this.bandwithHistory.push(updateSize);
        if(this.bandwithHistory.length > 50) this.bandwithHistory.splice(0, 1);
        let avgBandwith: number = 0;
        this.bandwithHistory.forEach((bandwith: number) => {
            avgBandwith += bandwith;
        });
        avgBandwith /= this.bandwithHistory.length;
        return avgBandwith;
    }

    private sendUpdate(update) {
        this.clients.forEach((client: ServerClient) => {
            if (client.IsReady) {
                let player: Player = this.world.getGameObject(client.PlayerId) as Player;
                if(player == null) {
                    return;
                }

                let snapshot: InputSnapshot = player.LastInputSnapshot;
                if(snapshot && snapshot.isMoving()) {
                    client.Socket.emit(SocketMsgs.UPDATE_GAME, update, [snapshot.ID, snapshot.SnapshotDelta]);
                } else {
                    client.Socket.emit(SocketMsgs.UPDATE_GAME, update);
                }
            }
        });
    }

    private collectAndCompressUpdate(callback: Function, complete: boolean = false) {
        let update: string = NetObjectsManager.Instance.collectUpdate(complete);

        if(update[0] == "$") {
            update = update.slice(1);
        }

        if(update == '') {
            return;
        }

        this.sendAndCompressUpdateThread.send(update).once("done", callback);
    }

    private clientDisconnected(client: ServerClient, reason?: string) {
        if(!client) return;

        if(reason) {
            client.Socket.emit(SocketMsgs.ERROR, reason);
        }

        console.log('player disconnected' + client.Name + " due " + reason);
        this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: client.Name + " has left game"});

        let gameObject: GameObject = this.world.getGameObject(client.PlayerId);
        if(gameObject != null) {
            gameObject.destroy();
        }
        this.clients.delete(client.Socket);
    }

    private initTestObjects() {
        let o: GameObject;
        // ////////////////////////////////////////////////////TEST ( CREATE WALLS AROUND MAP)
        for (let i = 0; i < (this.world.Height - 48) / 48; i++) {
            o= GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = 0;
            o.Transform.Y = i * o.Transform.Height;

            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = this.world.Width - o.Transform.Width;
            o.Transform.Y = i * o.Transform.Height;
        }

        for (let i = 1; i < (this.world.Width - 48) / 48; i++) {
            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = i * o.Transform.Width;
            o.Transform.Y = 0;

            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = i * o.Transform.Width;
            o.Transform.Y = this.world.Height - 52;
        }

        o = GameObjectsFactory.Instatiate("Obstacle");
        o.Transform.X = 150;
        o.Transform.Y = 150;
        o.Transform.Width = 150;

        o = GameObjectsFactory.Instatiate("Obstacle");
        o.Transform.X = 350;
        o.Transform.Y = 450;
        o.Transform.Width = 150;
        o.Transform.Rotation = 3;

        o = GameObjectsFactory.InstatiateWithTransform("Obstacle", new Transform(600, 600, 5, 300));
        o.Transform.Width = 1;
        o.Transform.Height = 300;

        let monsterCounter = 0;
        let spawnEnemy: Function = () => {
            monsterCounter++;
            let e: Enemy = GameObjectsFactory.Instatiate("Enemy") as Enemy;
            e.Transform.X = Math.floor(Math.random() * (this.world.Width - 200)) + 100;
            e.Transform.Y = Math.floor(Math.random() * (this.world.Height - 200) + 100);

            e.Name = "Monster " + monsterCounter.toString();

            e.addDestroyListener(() => {
                spawnEnemy();
            })
        };

        for (let i = 0; i < 10; i++) {
            spawnEnemy();
        }

        let spawnItem: Function = () => {
            let i: Item = GameObjectsFactory.Instatiate("Item") as Item;
            i.Transform.X = Math.floor(Math.random() * (this.world.Width - 200)) + 100;
            i.Transform.Y = Math.floor(Math.random() * (this.world.Height - 200) + 100);

            i.addDestroyListener(() => {
                spawnItem();
            })
        };

        for (let i = 0; i < 10; i++) {
            spawnItem();
        }
        ///////////////////////////////////////////////////////////////////TEST
    }
}

