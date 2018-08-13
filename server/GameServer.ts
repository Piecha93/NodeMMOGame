import * as SocketIO from 'socket.io';

import {ServerClient} from "./ServerClient";
import {Player} from "../common/game_utils/game/objects/Player";
import {InputSnapshot} from "../common/input/InputSnapshot";
import {GameObject} from "../common/game_utils/game/objects/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../common/net/SocketMsgs";
import {GameObjectsFactory} from "../common/game_utils/factory/ObjectsFactory";
import {Obstacle} from "../common/game_utils/game/objects/Obstacle";
import {Database, IUserModel} from "./database/Database";
import {Enemy} from "../common/game_utils/game/objects/Enemy";
import {Item} from "../common/game_utils/game/objects/Item";
import {Chunk} from "../common/game_utils/chunks/Chunk";
import {CommonConfig} from "../common/CommonConfig";
import {ObjectsSerializer} from "../common/serialize/ObjectsSerializer";
import {Transform} from "../common/game_utils/physics/Transform";
import {GameCore} from "../common/GameCore";
import {GameObjectsManager} from "../common/game_utils/factory/GameObjectsManager";


export class GameServer {
    private sockets: SocketIO.Server;

    private clients: Map<SocketIO.Server, ServerClient> = new Map<SocketIO.Server, ServerClient>();
    private userIdToSocketMap: Map<string, SocketIO.Server> = new Map<string, SocketIO.Server>();

    private core: GameCore;
    private playersLastSnapshots: Map<Player, InputSnapshot> = new Map<Player, InputSnapshot>();

    constructor(sockets: SocketIO.Server) {
        this.sockets = sockets;
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        this.core = new GameCore();

        this.initTestObjects();

        this.startGameLoop();
        this.startUpdateLoop();
    }

    private startGameLoop() {
        this.core.gameLoop();
        this.checkDisconnectInterval();

        setTimeout(() => {
            this.startGameLoop();
        }, ServerConfig.TICKRATE);
    }

    private startUpdateLoop() {
        setTimeout(() => {
            this.startUpdateLoop();
            this.collectAndSendUpdate();
        }, ServerConfig.UPDATE_INTERVAL);
    }

    private checkDisconnectInterval() {
        let now: number = Date.now();
        let expiredTime: number = now - ServerConfig.CLIENT_TIMEOUT_TIME;
        this.clients.forEach((client: ServerClient) => {
            if (client.LastHbTime <= expiredTime) {
                this.clientDisconnected(client, "timeout");
            }
        });
    }

    private configureSockets() {
        this.sockets.on(SocketMsgs.CONNECTION, this.onConnection.bind(this));
    }

    private onConnection(socket: SocketIO.Server) {
        // use to fake latency
        // (function() {
        //     let oldEmit = socket.emit;
        //     let fff: any = function() {
        //         let args = Array.from(arguments);
        //         setTimeout(() => {
        //             oldEmit.apply(this, args);
        //         }, 300);
        //     };
        //     socket.emit = fff;
        // })();

        let socketSession = (socket as any).request.session;

        if(this.userIdToSocketMap.has(socketSession.user_id)) {
            let client: ServerClient = this.clients.get(this.userIdToSocketMap.get(socketSession.user_id));
            this.clientDisconnected(client, "You have connected from another browser");
            this.userIdToSocketMap.delete(socketSession.user_id);
        }

        let serverClient: ServerClient = new ServerClient(socket);
        this.clients.set(socket, serverClient);
        this.userIdToSocketMap.set(socketSession.user_id, socket);

        if(socketSession.user_id.substring(0, 5) == "Guest") {
            serverClient.Name = socketSession.user_id;
        } else {
            Database.Instance.findUserById(socketSession.user_id, (user: IUserModel) => {
                serverClient.Name = user.username;
                let player: Player = GameObjectsManager.GetGameObjectById(serverClient.PlayerId) as Player;
                if(player) {
                    player.Name = serverClient.Name;
                }
            })
        }

        socket.on(SocketMsgs.CLIENT_READY, () => {
            let player: Player = GameObjectsFactory.InstatiateWithTransform("Player",
                new Transform(this.getRandomInsideMap(), this.getRandomInsideMap(), 32, 32)) as Player;

            player.Name = serverClient.Name;
            serverClient.PlayerId = player.ID;

            socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID});

            socket.emit(SocketMsgs.FIRST_UPDATE_GAME, [ObjectsSerializer.serializeObject(player)]);
            serverClient.IsReady = true;

            this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: player.Name + " has joined game"});
        });

        socket.on(SocketMsgs.INPUT_SNAPSHOT, (data) => {
            let player: Player = GameObjectsManager.GetGameObjectById(serverClient.PlayerId) as Player;
            if(player == null) {
                return;
            }

            let snapshot: InputSnapshot = new InputSnapshot();
            snapshot.deserialize(data);
            player.setInput(snapshot);

            this.playersLastSnapshots.set(player, snapshot);
        });

        socket.on(SocketMsgs.HEARTBEAT, (data: number) => {
            if(this.clients.has(socket)) {
                this.clients.get(socket).LastHbTime = Date.now();
                socket.emit(SocketMsgs.HEARTBEAT_RESPONSE, data);
            }
        });

        socket.on(SocketMsgs.CHAT_MESSAGE, (msg: string) => {
            if(msg == "sp") {
                let player: Player = GameObjectsManager.GetGameObjectById(serverClient.PlayerId) as Player;

                let e: Enemy = GameObjectsFactory.InstatiateWithTransform("Enemy",
                    new Transform(player.Transform.X, player.Transform.Y, 40, 64)) as Enemy;

                e.Name = "Michau";
            }
            else if(this.clients.has(socket)) {
                this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: serverClient.Name, m: msg});
            }
        });

        socket.on(SocketMsgs.DISCONNECT, () => {
            this.clientDisconnected(this.clients.get(socket), "disconnected");
        });
    }

    private sendUpdate(chunksUpdate: Map<Chunk, ArrayBuffer>) {
        this.clients.forEach((client: ServerClient) => {
            if (client.IsReady) {
                let player: Player = GameObjectsManager.GetGameObjectById(client.PlayerId) as Player;
                if(player == null) {
                    return;
                }

                let chunk: Chunk = this.core.ChunksManager.getObjectChunk(player);

                let updateArray: Array<ArrayBuffer> = [];
                if(chunksUpdate.has(chunk)) {
                    updateArray.push(chunksUpdate.get(chunk));
                }

                chunk.Neighbors.forEach((chunkNeighbor: Chunk) => {
                    if(chunksUpdate.has(chunkNeighbor)) {
                        updateArray.push(chunksUpdate.get(chunkNeighbor));
                    }
                });

                let snapshot: InputSnapshot = this.playersLastSnapshots.get(player);
                if(snapshot && snapshot.isMoving()) {
                    client.Socket.emit(SocketMsgs.UPDATE_SNAPSHOT_DATA, [snapshot.ID, snapshot.SnapshotDelta]);
                }
                if(updateArray.length > 0) {
                    client.Socket.emit(SocketMsgs.UPDATE_GAME, updateArray);
                }
            }
        });
    }

    private collectAndSendUpdate() {
        this.sendUpdate(this.core.collectUpdate());
    }

    private clientDisconnected(client: ServerClient, reason?: string) {
        if(!client) return;

        if(reason) {
            client.Socket.emit(SocketMsgs.ERROR, reason);
        }

        console.log('player disconnected' + client.Name + " due " + reason);
        this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: client.Name + " has left game"});

        GameObjectsManager.DestroyGameObjectById(client.PlayerId);
        this.clients.delete(client.Socket);
    }

    private getRandomInsideMap(): number {
        return Math.floor(Math.random() * (CommonConfig.numOfChunksX * CommonConfig.chunkSize - 100)) + 50;
    }

    private initTestObjects() {
        let o: GameObject;

        // for (let i = 0; i < 100000; i++) {
        //     o = GameObjectsFactory.InstatiateWithTransform("Obstacle",
        //         new Transform(this.getRandomInsideMap(), this.getRandomInsideMap(), 32, 32));
        //
        //     if (i % 1000 == 0) {
        //         console.log(i)
        //     }
        // }

        let wallsCounter = 0;
        for (let i = 0; i < (CommonConfig.numOfChunksX * CommonConfig.chunkSize / 32); i++) {
            o = GameObjectsFactory.InstatiateWithTransform("Obstacle",
                new Transform(i * 32, 0, 32, 32));

            o = GameObjectsFactory.InstatiateWithTransform("Obstacle",
                new Transform(i * 32, CommonConfig.numOfChunksY * CommonConfig.chunkSize - 32, 32, 32));

            wallsCounter += 2;
        }

        for (let i = 1; i < (CommonConfig.numOfChunksY * CommonConfig.chunkSize / 32) - 1; i++) {
            wallsCounter += 2;
            o = GameObjectsFactory.InstatiateWithTransform("Obstacle",
                new Transform(0, i * 32, 32, 32));

            o = GameObjectsFactory.InstatiateWithTransform("Obstacle",
                new Transform(CommonConfig.numOfChunksX * CommonConfig.chunkSize - 32, i * 32, 32, 32));
        }

        console.log("wallsCounter " + wallsCounter);

        let enemyCounter = 0;
        let spawnEnemy: Function = () => {
            enemyCounter++;
            let e: Enemy = GameObjectsFactory.InstatiateWithTransform("Enemy",
                new Transform(this.getRandomInsideMap(), this.getRandomInsideMap(), 40, 64)) as Enemy;

            e.Name = "Michau " + enemyCounter.toString();

            e.addDestroyListener(() => {
                spawnEnemy();
            })
        };

        for (let i = 0; i < 0; i++) {
            spawnEnemy();
        }

        let spawnItem: Function = () => {
            let i: Item = GameObjectsFactory.InstatiateWithTransform("Item",
                new Transform(this.getRandomInsideMap(), this.getRandomInsideMap(), 32, 32)) as Item;

            i.addDestroyListener(() => {
                spawnItem();
            })
        };

        for (let i = 0; i < 0; i++) {
            spawnItem();
        }

        let chunksIter = this.core.ChunksManager.ChunksIterator();
        let chunk: Chunk;
        while (chunk = chunksIter.next().value) {
            chunk.deactivate();
        }
    }
}