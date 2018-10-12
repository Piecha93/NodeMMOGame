import * as SocketIO from 'socket.io';

import {ServerClient} from "./ServerClient";
import {Player} from "../shared/game_utils/game/objects/Player";
import {InputSnapshot} from "../shared/input/InputSnapshot";
import {GameObject} from "../shared/game_utils/game/objects/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../shared/net/SocketMsgs";
import {GameObjectsFactory} from "../shared/game_utils/factory/ObjectsFactory";
import {Database, IUserModel} from "./database/Database";
import {Enemy} from "../shared/game_utils/game/objects/Enemy";
import {Item} from "../shared/game_utils/game/objects/Item";
import {Chunk} from "../shared/chunks/Chunk";
import {SharedConfig} from "../shared/SharedConfig";
import {ObjectsSerializer} from "../shared/serialize/ObjectsSerializer";
import {GameCore} from "../shared/GameCore";
import {GameObjectsManager} from "../shared/game_utils/factory/GameObjectsManager";
import {MagicWand} from "../shared/game_utils/game/weapons/MagicWand";
import {ObjectsSpawner} from "../shared/game_utils/game/weapons/ObjectsSpawner";


export class GameServer {
    private sockets: SocketIO.Server;

    private clients: Map<SocketIO.Server, ServerClient> = new Map<SocketIO.Server, ServerClient>();
    private userIdToSocketMap: Map<string, SocketIO.Server> = new Map<string, SocketIO.Server>();

    private core: GameCore;
    private playersLastSnapshots: Map<Player, InputSnapshot> = new Map<Player, InputSnapshot>();

    private lastChunkSent: Map<Player, Chunk> = new Map<Player, Chunk>(); //TODO move this somewhere else

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
        socket.compress(false);
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
            let player: Player = GameObjectsFactory.InstatiateWithPosition("DefaultPlayer",
                [this.getRandomInsideMap(), this.getRandomInsideMap()]) as Player;

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
            if(msg == "fire") {
                let player: Player = GameObjectsManager.GetGameObjectById(serverClient.PlayerId) as Player;
                player.Weapon = new MagicWand();
            } else if(msg == "spawner") {
                let player: Player = GameObjectsManager.GetGameObjectById(serverClient.PlayerId) as Player;
                player.Weapon = new ObjectsSpawner();
            } else if(this.clients.has(socket)) {
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

                if(this.lastChunkSent.get(player) != chunk) {
                    client.Socket.emit(SocketMsgs.CHUNK_MOVED, chunk.Position);
                    this.lastChunkSent.set(player, chunk);
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
        return Math.round((Math.floor(Math.random() * (SharedConfig.numOfChunksX * SharedConfig.chunkSize - 100)) + 50) / 32) * 32;
    }

    private initTestObjects() {
        let o: GameObject;

        for (let i = 0; i < 10000; i++) {
            o = GameObjectsFactory.InstatiateWithPosition("Wall",
                [this.getRandomInsideMap(), this.getRandomInsideMap()]);

            if (i % 1000 == 0) {
                console.log(i)
            }
        }

        let wallsCounter = 0;
        for (let i = 0; i < (SharedConfig.numOfChunksX * SharedConfig.chunkSize / 32); i++) {
            o = GameObjectsFactory.InstatiateWithPosition("Wall", [i * 32, 0]);

            o = GameObjectsFactory.InstatiateWithPosition("Wall",
                [i * 32, SharedConfig.numOfChunksY * SharedConfig.chunkSize - 32]);

            wallsCounter += 2;
        }

        for (let i = 1; i < (SharedConfig.numOfChunksY * SharedConfig.chunkSize / 32) - 1; i++) {
            wallsCounter += 2;
            o = GameObjectsFactory.InstatiateWithPosition("Wall",
                [0, i * 32]);

            o = GameObjectsFactory.InstatiateWithPosition("Wall",
                [SharedConfig.numOfChunksX * SharedConfig.chunkSize - 32, i * 32]);
        }

        console.log("wallsCounter " + wallsCounter);

        let enemyCounter = 0;
        let spawnEnemy: Function = () => {
            enemyCounter++;
            let e: Enemy = GameObjectsFactory.InstatiateWithPosition("Michau",
                [this.getRandomInsideMap(), this.getRandomInsideMap()]) as Enemy;

            e.Name = "Michau " + enemyCounter.toString();

            e.addDestroyListener(() => {
                spawnEnemy();
            })
        };

        for (let i = 0; i < 0; i++) {
            spawnEnemy();
        }

        let spawnItem: Function = () => {
            let i: Item = GameObjectsFactory.InstatiateWithPosition("HpPotion",
                [this.getRandomInsideMap(), this.getRandomInsideMap()]) as Item;

            i.addDestroyListener(() => {
                spawnItem();
            })
        };

        for (let i = 0; i < 0; i++) {
            spawnItem();
        }

        // let chunksIter = this.core.ChunksManager.ChunksIterator();
        // let chunk: Chunk;
        // while (chunk = chunksIter.next().value) {
        //     chunk.deactivate();
        // }
    }
}