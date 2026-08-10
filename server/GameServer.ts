import {Server, Socket} from "socket.io";

import {ServerClient} from "./ServerClient";
import {Player} from "../shared/game_utils/game/objects/Player";
import {InputSnapshot, InvalidInputSnapshotError} from "../shared/input/InputSnapshot";
import {GameObject} from "../shared/game_utils/game/objects/GameObject";
import {ServerConfig} from "./ServerConfig";
import {SocketMsgs} from "../shared/net/SocketMsgs";
import {Database, IUserModel} from "./database/Database";
import {Enemy} from "../shared/game_utils/game/objects/Enemy";
import {Item} from "../shared/game_utils/game/objects/Item";
import {Chunk} from "../shared/chunks/Chunk";
import {SharedConfig} from "../shared/SharedConfig";
import {ObjectsSerializer} from "../shared/serialize/ObjectsSerializer";
import {GameCore} from "../shared/GameCore";
import {MagicWand} from "../shared/game_utils/game/weapons/MagicWand";
import {ObjectsSpawner} from "../shared/game_utils/game/weapons/ObjectsSpawner";
import {ClientsInputSnapshotHandler} from "./ClientsInputSnapshotHandler";
import {registerGameObjectPrefabs} from "../shared/game_utils/factory/RegisterGameObjectPrefabs";

registerGameObjectPrefabs();

export class GameServer {
    private sockets: Server;

    private clients: Map<Socket, ServerClient> = new Map<Socket, ServerClient>();
    private userIdToSocketMap: Map<string, Socket> = new Map<string, Socket>();

    private core: GameCore;


    private lastChunkSent: Map<string, Chunk> = new Map<string, Chunk>(); //TODO move this somewhere else
    private clientsInputSnapshotHandler: ClientsInputSnapshotHandler;
    private lastDisconnectCheck: number = 0;

    constructor(sockets: Server) {
        this.sockets = sockets;
        this.core = new GameCore();
        this.clientsInputSnapshotHandler = new ClientsInputSnapshotHandler(this.core.ObjectsManager);
    }

    public start() {
        this.startGame();
        this.configureSockets();
    }

    private startGame() {
        Player.EnableDebugActions = ServerConfig.ENABLE_DEBUG_COMMANDS;

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
        if (now - this.lastDisconnectCheck < ServerConfig.DISCONNECT_CHECK_INTERVAL) {
            return;
        }

        this.lastDisconnectCheck = now;
        let expiredTime: number = now - ServerConfig.CLIENT_TIMEOUT_TIME;
        Array.from(this.clients.values()).forEach((client: ServerClient) => {
            if (client.LastHbTime <= expiredTime) {
                this.clientDisconnected(client, "timeout");
            }
        });
    }

    private configureSockets() {
        this.sockets.on(SocketMsgs.CONNECTION, this.onConnection.bind(this));
    }

    private onConnection(socket: Socket) {
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

        const socketSession = (socket.request as typeof socket.request & {
            session?: {user_id?: string};
        }).session;
        const userId = socketSession?.user_id;

        if (!userId) {
            socket.emit(SocketMsgs.ERROR, "Missing authenticated session");
            socket.disconnect(true);
            return;
        }

        const previousSocket = this.userIdToSocketMap.get(userId);
        if (previousSocket && previousSocket !== socket) {
            const previousClient = this.clients.get(previousSocket);
            if (previousClient) {
                this.clientDisconnected(previousClient, "You have connected from another browser");
            } else {
                this.userIdToSocketMap.delete(userId);
                previousSocket.disconnect(true);
            }
        }

        let serverClient: ServerClient = new ServerClient(socket, userId);
        this.clients.set(socket, serverClient);
        this.userIdToSocketMap.set(userId, socket);

        if(userId.startsWith("Guest")) {
            serverClient.Name = userId;
        } else {
            serverClient.Name = "User";
            void Database.Instance.findUserById(userId).then((user: IUserModel | null) => {
                if (!user || !this.isConnectedClient(serverClient)) {
                    return;
                }
                serverClient.Name = this.sanitizePlayerName(user.username);
                let player: Player = this.core.ObjectsManager.get(serverClient.PlayerId) as Player;
                if(player) {
                    player.Name = serverClient.Name;
                }
            }).catch((error) => console.error("Unable to load user:", error));
        }

        socket.on(SocketMsgs.CLIENT_READY, () => {
            if (!this.isConnectedClient(serverClient) || serverClient.IsReady) {
                return;
            }

            let player: Player = this.core.ObjectsFactory.instantiateWithPosition("DefaultPlayer",
                [
                    this.getRandomInsideMap(SharedConfig.numOfChunksX),
                    this.getRandomInsideMap(SharedConfig.numOfChunksY)
                ]) as Player;

            player.Name = serverClient.Name;
            serverClient.PlayerId = player.ID;
            serverClient.IsReady = true;

            socket.emit(SocketMsgs.INITIALIZE_GAME, { id: player.ID});

            socket.emit(SocketMsgs.FIRST_UPDATE_GAME, [ObjectsSerializer.serializeObject(player)]);

            this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: player.Name + " has joined game"});
        });

        socket.on(SocketMsgs.INPUT_SNAPSHOT, (snapshotData: unknown) => {
            if (!this.isConnectedClient(serverClient) ||
                !serverClient.allowEvent(
                    "input",
                    ServerConfig.MAX_INPUT_SNAPSHOTS_PER_WINDOW,
                    ServerConfig.RATE_LIMIT_WINDOW
                ) ||
                typeof snapshotData !== "string" ||
                snapshotData.length > InputSnapshot.MAX_SERIALIZED_LENGTH) {
                return;
            }

            const player = this.getReadyPlayer(serverClient);
            if (!player) {
                return;
            }

            try {
                this.clientsInputSnapshotHandler.setSnapshot(player, snapshotData);
            } catch (error) {
                if (!(error instanceof InvalidInputSnapshotError)) {
                    console.error("Unable to process input snapshot:", error);
                }
            }
        });

        socket.on(SocketMsgs.HEARTBEAT, (data: unknown) => {
            if (this.isConnectedClient(serverClient) &&
                serverClient.allowEvent(
                    "heartbeat",
                    ServerConfig.MAX_HEARTBEATS_PER_WINDOW,
                    ServerConfig.RATE_LIMIT_WINDOW
                ) &&
                typeof data === "number" &&
                Number.isSafeInteger(data)) {
                serverClient.LastHbTime = Date.now();
                socket.emit(SocketMsgs.HEARTBEAT_RESPONSE, data);
            }
        });

        socket.on(SocketMsgs.CHAT_MESSAGE, (msg: unknown) => {
            if (!this.isConnectedClient(serverClient) ||
                !serverClient.allowEvent(
                    "chat",
                    ServerConfig.MAX_CHAT_MESSAGES_PER_WINDOW,
                    ServerConfig.RATE_LIMIT_WINDOW
                ) ||
                typeof msg !== "string" ||
                msg.length > ServerConfig.MAX_CHAT_MESSAGE_LENGTH) {
                return;
            }

            const chatMessage = msg.trim();
            if (!chatMessage) {
                return;
            }

            if (chatMessage === "fire" || chatMessage === "spawner") {
                const player = this.getReadyPlayer(serverClient);
                if (!ServerConfig.ENABLE_DEBUG_COMMANDS || !player) {
                    return;
                }

                player.Weapon = chatMessage === "fire" ? new MagicWand() : new ObjectsSpawner();
                return;
            }

            this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: serverClient.Name, m: chatMessage});
        });

        socket.on(SocketMsgs.DISCONNECT, () => {
            this.clientDisconnected(this.clients.get(socket), "disconnected");
        });
    }

    private sendUpdate(chunksUpdate: Map<Chunk, ArrayBuffer>) {
        this.clients.forEach((client: ServerClient) => {
            if (this.isConnectedClient(client) && client.IsReady) {
                const player = this.getReadyPlayer(client);
                if (!player) {
                    return;
                }

                let chunk: Chunk = this.core.ChunksManager.getObjectChunk(player);
                if (!chunk) {
                    return;
                }

                let updateArray: Array<ArrayBuffer> = [];
                if(chunksUpdate.has(chunk)) {
                    updateArray.push(chunksUpdate.get(chunk));
                }

                chunk.Neighbors.forEach((chunkNeighbor: Chunk) => {
                    if(chunksUpdate.has(chunkNeighbor)) {
                        updateArray.push(chunksUpdate.get(chunkNeighbor));
                    }
                });

                let snapshot: InputSnapshot = this.clientsInputSnapshotHandler.getPlayerLastSnapshot(player);
                if(snapshot && snapshot.isMoving()) {
                    client.Socket.emit(SocketMsgs.UPDATE_SNAPSHOT_DATA, [snapshot.ID, snapshot.SnapshotDelta]);
                }

                if(this.lastChunkSent.get(client.PlayerId) != chunk) {
                    client.Socket.emit(SocketMsgs.CHUNK_CHANGED, chunk.Position);
                    this.lastChunkSent.set(client.PlayerId, chunk);
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
        if (!client || client.IsDisconnected) {
            return;
        }

        client.IsDisconnected = true;
        const socket = client.Socket;
        const playerId = client.PlayerId;
        const wasReady = client.IsReady;

        this.clients.delete(socket);
        if (this.userIdToSocketMap.get(client.UserId) === socket) {
            this.userIdToSocketMap.delete(client.UserId);
        }
        if (playerId) {
            this.lastChunkSent.delete(playerId);
            this.core.ObjectsManager.destroy(playerId);
        }

        client.IsReady = false;
        client.PlayerId = "";

        if (reason && socket.connected) {
            socket.emit(SocketMsgs.ERROR, reason);
        }

        console.log('player disconnected' + client.Name + " due " + reason);
        if (wasReady) {
            this.sockets.emit(SocketMsgs.CHAT_MESSAGE, {s: "Server", m: client.Name + " has left game"});
        }

        if (socket.connected) {
            socket.disconnect(true);
        }
    }

    private isConnectedClient(client: ServerClient): boolean {
        return !client.IsDisconnected && this.clients.get(client.Socket) === client;
    }

    private getReadyPlayer(client: ServerClient): Player | null {
        if (!this.isConnectedClient(client) || !client.IsReady || !client.PlayerId) {
            return null;
        }

        return this.core.ObjectsManager.get(client.PlayerId) as Player || null;
    }

    private sanitizePlayerName(name: unknown): string {
        if (typeof name !== "string") {
            return "User";
        }

        const safeName = name
            .normalize("NFKC")
            .replace(/[^\p{L}\p{N} _-]/gu, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 32);

        return safeName || "User";
    }

    private getRandomInsideMap(numberOfChunks: number): number {
        return Math.round((Math.floor(Math.random() * (numberOfChunks * SharedConfig.chunkSize - 100)) + 50) / 32) * 32;
    }

    private initTestObjects() {
        let o: GameObject;

        for (let i = 0; i < 1000; i++) {
            o = this.core.ObjectsFactory.instantiateWithPosition("Wall",
                [
                    this.getRandomInsideMap(SharedConfig.numOfChunksX),
                    this.getRandomInsideMap(SharedConfig.numOfChunksY)
                ]);

            if (i % 1000 == 0) {
                console.log(i)
            }
        }

        let enemyCounter = 0;
        let spawnEnemy: Function = () => {
            enemyCounter++;
            let e: Enemy = this.core.ObjectsFactory.instantiateWithPosition("Michau",
                [
                    this.getRandomInsideMap(SharedConfig.numOfChunksX),
                    this.getRandomInsideMap(SharedConfig.numOfChunksY)
                ]) as Enemy;

            e.Name = "Michau " + enemyCounter.toString();

            e.addDestroyListener(() => {
                spawnEnemy();
            })
        };

        for (let i = 0; i < 0; i++) {
            spawnEnemy();
        }

        let spawnItem: Function = () => {
            let i: Item = this.core.ObjectsFactory.instantiateWithPosition("HpPotion",
                [
                    this.getRandomInsideMap(SharedConfig.numOfChunksX),
                    this.getRandomInsideMap(SharedConfig.numOfChunksY)
                ]) as Item;

            i.addDestroyListener(() => {
                spawnItem();
            })
        };

        for (let i = 0; i < 0; i++) {
            spawnItem();
        }
    }
}
