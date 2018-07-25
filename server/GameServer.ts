import * as SocketIO from 'socket.io';

import {ServerClient} from "./ServerClient";
import {GameWorld} from "../common/GameWorld";
import {Player} from "../common/utils/game/Player";
import {InputSnapshot} from "../common/input/InputSnapshot";
import {NetObjectsSerializer} from "../common/serialize/NetObjectsSerializer";
import {GameObject} from "../common/utils/game/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../common/net/SocketMsgs";
import {GameObjectsFactory} from "../common/utils/factory/ObjectsFactory";
import {DeltaTimer} from "../common/DeltaTimer";
import {Obstacle} from "../common/utils/game/Obstacle";
import {Database, IUserModel} from "./database/Database";
import {Enemy} from "../common/utils/game/Enemy";
import {Transform} from "../common/utils/physics/Transform";
import {Item} from "../common/utils/game/Item";
import {Chunk, ChunksManager} from "../common/utils/Chunks";
import {CommonConfig} from "../common/CommonConfig";


export class GameServer {
    private sockets: SocketIO.Server;
    private clients: Map<SocketIO.Server, ServerClient> = new Map<SocketIO.Server, ServerClient>();
    private socketsIds: Map<string, SocketIO.Server> = new Map<string, SocketIO.Server>();
    private netObjectsSerializer: NetObjectsSerializer = null;

    private world: GameWorld;

    constructor(sockets: SocketIO.Server) {
        this.sockets = sockets;
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        this.world = new GameWorld();
        this.netObjectsSerializer = new NetObjectsSerializer(this.world.ChunksManager);

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
            this.collectAndSendUpdate(false);
        }
        setTimeout(() => {
            // let o = GameObjectsFactory.Instatiate("Obstacle");
            // o.Transform.X = Math.random() * 10*32*50;
            // o.Transform.Y = Math.random() * 10*32*50;
            //
            // console.log("game objects " + this.world.GameObjectsMapById.size);
            this.startGameLoop();
        }, ServerConfig.TICKRATE);
    }

    private configureSockets() {
        this.sockets.on(SocketMsgs.CONNECTION, (socket: SocketIO.Server) => {
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
                player.Transform.X = Math.floor(Math.random() * 300) + 50;
                player.Transform.Y = Math.floor(Math.random() * 300) + 50;

                player.Name = serverClient.Name;

                serverClient.PlayerId = player.ID;

                socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID});

                // player.forceCompleteUpdate();
                // let updateBuffer: ArrayBuffer = NetObjectsSerializer.Instance.collectUpdate(true);

                let objectNeededSize = player.calcNeededBufferSize(true) + 5;
                let updateBuffer: ArrayBuffer = new ArrayBuffer(objectNeededSize );
                let updateBufferView: DataView = new DataView(updateBuffer);

                updateBufferView.setUint8(0, player.ID.charCodeAt(0));
                updateBufferView.setUint32(1, Number(player.ID.slice(1)));
                player.serialize(updateBufferView, 5, true);

                socket.emit(SocketMsgs.FIRST_UPDATE_GAME, updateBuffer);
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

        setInterval(() => {
            this.clients.forEach((client: ServerClient) => {
                if(client.IsReady) {
                    client.LastHbInterval -= 1000;
                } else {
                    client.LastHbInterval -= 500;
                }
                if (client.LastHbInterval <= 0) {
                    this.clientDisconnected(client, "timeout");
                }
            });
        }, ServerConfig.DISCONNECT_CHECK_INTERVAL);
    }

    private sendUpdate(updateBuffer: Map<Chunk, ArrayBuffer>) {
        let chunksManager: ChunksManager = this.world.ChunksManager;
        this.clients.forEach((client: ServerClient) => {
            if (client.IsReady) {
                let player: Player = this.world.getGameObject(client.PlayerId) as Player;
                if(player == null) {
                    return;
                }

                let chunk: Chunk = chunksManager.getObjectChunk(player);

                if(!chunk) {
                    return;
                }

                let updateArray: Array<ArrayBuffer> = [];
                if(updateBuffer.get(chunk).byteLength > 1) {
                    updateArray.push(updateBuffer.get(chunk));
                }

                chunk.Neighbors.forEach((chunkNeighbor: Chunk) => {
                    if(updateBuffer.get(chunkNeighbor).byteLength > 1) {
                        updateArray.push(updateBuffer.get(chunkNeighbor));
                    }
                });

                let snapshot: InputSnapshot = player.LastInputSnapshot;
                if(snapshot && snapshot.isMoving()) {
                    client.Socket.emit(SocketMsgs.LAST_SNAPSHOT_DATA, [snapshot.ID, snapshot.SnapshotDelta]);
                }
                if(updateArray.length > 0) {
                    client.Socket.emit(SocketMsgs.UPDATE_GAME, updateArray);
                }
            }
        });
    }

    private collectAndSendUpdate(complete: boolean = false) {
        this.sendUpdate(this.netObjectsSerializer.collectUpdate(complete));

        for(let i = 0; i < this.world.ChunksManager.Chunks.length; i++) {
            this.world.ChunksManager.Chunks[i].resetHasNewComers();
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

    private initTestObjects() {
        let o: GameObject;

        for (let i = 0; i < 10000; i++) {
            o= GameObjectsFactory.Instatiate("Obstacle");
            o.Transform.X = Math.random() * CommonConfig.numOfChunksX*32*CommonConfig.chunkSize;
            o.Transform.Y = Math.random() * CommonConfig.numOfChunksY*32*CommonConfig.chunkSize;
        }

        let monsterCounter = 0;
        let spawnEnemy: Function = () => {
            monsterCounter++;
            let e: Enemy = GameObjectsFactory.Instatiate("Enemy") as Enemy;
            e.Transform.X = Math.floor(Math.random() * 10*32*50);
            e.Transform.Y = Math.floor(Math.random() * 10*32*50);

            e.Name = "Michau " + monsterCounter.toString();

            e.addDestroyListener(() => {
                spawnEnemy();
            })
        };

        for (let i = 0; i < 300; i++) {
            spawnEnemy();
        }

        let spawnItem: Function = () => {
            let i: Item = GameObjectsFactory.Instatiate("Item") as Item;
            i.Transform.X = Math.floor(Math.random() * 10*32*50);
            i.Transform.Y = Math.floor(Math.random() * 10*32*50);

            i.addDestroyListener(() => {
                spawnItem();
            })
        };

        for (let i = 0; i < 100; i++) {
            spawnItem();
        }
        ///////////////////////////////////////////////////////////////////TEST
    }
}