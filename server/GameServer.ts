import * as SocketIO from 'socket.io';

import {ServerClient} from "./ServerClient";
import {GameWorld} from "../common/GameWorld";
import {Player} from "../common/game_utils/game/objects/Player";
import {InputSnapshot} from "../common/input/InputSnapshot";
import {NetObjectsSerializer} from "../common/serialize/NetObjectsSerializer";
import {GameObject} from "../common/game_utils/game/objects/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../common/net/SocketMsgs";
import {GameObjectsFactory} from "../common/game_utils/factory/ObjectsFactory";
import {DeltaTimer} from "../common/DeltaTimer";
import {Obstacle} from "../common/game_utils/game/objects/Obstacle";
import {Database, IUserModel} from "./database/Database";
import {Enemy} from "../common/game_utils/game/objects/Enemy";
import {Item} from "../common/game_utils/game/objects/Item";
import {ChunksManager} from "../common/game_utils/chunks/ChunksManager";
import {Chunk} from "../common/game_utils/chunks/Chunk";
import {CommonConfig} from "../common/CommonConfig";


export class GameServer {
    private sockets: SocketIO.Server;

    private clients: Map<SocketIO.Server, ServerClient> = new Map<SocketIO.Server, ServerClient>();
    private userIdToSocketMap: Map<string, SocketIO.Server> = new Map<string, SocketIO.Server>();

    private world: GameWorld = null;
    private chunksManager: ChunksManager = null;
    private netObjectsSerializer: NetObjectsSerializer = null;

    private deltaTimer: DeltaTimer = new DeltaTimer();

    constructor(sockets: SocketIO.Server) {
        this.sockets = sockets;
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        this.world = new GameWorld();
        this.chunksManager = new ChunksManager();
        this.netObjectsSerializer = new NetObjectsSerializer(this.chunksManager);

        // GameObjectsFactory.DestroyCallbacks.push((gameObject: GameObject) => {
        //     if(gameObject instanceof Actor) {
        //         this.sockets.emit(SocketMsgs.CHAT_MESSAGE,
        //             {s: "Server", m: (gameObject as Actor).Name + " has been slain"});
        //     }
        // });

        this.initTestObjects();

        this.startGameLoop();
        this.startUpdateLoop();
    }

    private startGameLoop() {
        let delta: number = this.deltaTimer.getDelta();
        this.checkDisconnectInterval(delta);

        this.world.update(delta);
        this.chunksManager.rebuild();

        setTimeout(() => {
            this.startGameLoop();
        }, ServerConfig.TICKRATE);
    }

    private startUpdateLoop() {
        setTimeout(() => {
            this.startUpdateLoop();
            this.collectAndSendUpdate(false);
        }, ServerConfig.UPDATE_INTERVAL);
    }

    private checkDisconnectInterval(delta: number) {
        this.clients.forEach((client: ServerClient) => {
            client.LastHbInterval -= delta;
            if (client.LastHbInterval <= 0) {
                this.clientDisconnected(client, "timeout");
            }
        });
    }

    private configureSockets() {
        this.sockets.on(SocketMsgs.CONNECTION, (socket: SocketIO.Server) => {
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
                    let player: Player = this.world.getGameObject(serverClient.PlayerId) as Player;
                    if(player) {
                        player.Name = serverClient.Name;
                    }
                })
            }

            socket.on(SocketMsgs.CLIENT_READY, () => {
                let player: Player = GameObjectsFactory.Instatiate("Player") as Player;
                player.Transform.X = this.getRandomInsideMap();
                player.Transform.Y = this.getRandomInsideMap();

                player.Name = serverClient.Name;

                serverClient.PlayerId = player.ID;

                socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID});

                socket.emit(SocketMsgs.FIRST_UPDATE_GAME, this.netObjectsSerializer.collectObjectUpdate(player));
                serverClient.IsReady = true;

                this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: player.Name + " has joined game"});
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
    }

    private sendUpdate(chunksUpdate: Map<Chunk, ArrayBuffer>) {
        this.clients.forEach((client: ServerClient) => {
            if (client.IsReady) {
                let player: Player = this.world.getGameObject(client.PlayerId) as Player;
                if(player == null) {
                    return;
                }

                let chunk: Chunk = this.chunksManager.getObjectChunk(player);

                let updateArray: Array<ArrayBuffer> = [];
                if(chunksUpdate.has(chunk)) {
                    updateArray.push(chunksUpdate.get(chunk));
                }

                chunk.Neighbors.forEach((chunkNeighbor: Chunk) => {
                    if(chunksUpdate.has(chunkNeighbor)) {
                        updateArray.push(chunksUpdate.get(chunkNeighbor));
                    }
                });

                let snapshot: InputSnapshot = player.LastInputSnapshot;
                if(snapshot && snapshot.isMoving()) {
                    client.Socket.emit(SocketMsgs.UPDATE_SNAPSHOT_DATA, [snapshot.ID, snapshot.SnapshotDelta]);
                }
                if(updateArray.length > 0) {
                    client.Socket.emit(SocketMsgs.UPDATE_GAME, updateArray);
                }
            }
        });
    }

    private collectAndSendUpdate(complete: boolean = false) {
        this.sendUpdate(this.netObjectsSerializer.collectUpdate(complete));

        let chunks: Chunk[][] = this.chunksManager.Chunks;
        for(let i = 0; i < chunks.length; i++) {
            for (let j = 0; j < chunks[i].length; j++) {
                chunks[i][j].resetHasNewComers();
            }
        }
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

    private getRandomInsideMap(): number {
        return Math.floor(Math.random() * (CommonConfig.numOfChunksX * CommonConfig.chunkSize - 100)) + 50;
    }

    private initTestObjects() {
        let o: GameObject;

        for (let i = 0; i < 5000; i++) {
            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = this.getRandomInsideMap();
            o.Transform.Y = this.getRandomInsideMap();

            if (i % 1000 == 0) {
                console.log(i)
            }
        }

        let wallsCounter = 0;
        for (let i = 0; i < (CommonConfig.numOfChunksX * CommonConfig.chunkSize / 32); i++) {
            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = i * 32;
            o.Transform.Y = 0;

            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = i * 32;
            o.Transform.Y = CommonConfig.numOfChunksY * CommonConfig.chunkSize - 32;

            wallsCounter += 2;
        }

        for (let i = 1; i < (CommonConfig.numOfChunksY * CommonConfig.chunkSize / 32) - 1; i++) {
            wallsCounter += 2;
            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = 0;
            o.Transform.Y = i * 32;

            o = GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = CommonConfig.numOfChunksX * CommonConfig.chunkSize - 32;
            o.Transform.Y = i * 32;
        }

        console.log("wallsCounter " + wallsCounter);

        let enemyCounter = 0;
        let spawnEnemy: Function = () => {
            enemyCounter++;
            let e: Enemy = GameObjectsFactory.Instatiate("Enemy") as Enemy;
            e.Transform.X = this.getRandomInsideMap();
            e.Transform.Y = this.getRandomInsideMap();

            e.Name = "Michau " + enemyCounter.toString();

            e.addDestroyListener(() => {
                spawnEnemy();
            })
        };

        for (let i = 0; i < 500; i++) {
            spawnEnemy();
        }

        let spawnItem: Function = () => {
            let i: Item = GameObjectsFactory.Instatiate("Item") as Item;
            i.Transform.X = this.getRandomInsideMap();
            i.Transform.Y = this.getRandomInsideMap();

            i.addDestroyListener(() => {
                spawnItem();
            })
        };

        for (let i = 0; i < 50; i++) {
            spawnItem();
        }
        ///////////////////////////////////////////////////////////////////TEST
    }
}