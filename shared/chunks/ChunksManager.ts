import { GameObject } from "../game_utils/game/objects/GameObject";

import { Chunk } from "./Chunk";
import { GameObjectsManager } from "../game_utils/factory/GameObjectsManager";
import { GameObjectsFactory } from "../game_utils/factory/ObjectsFactory";

export class ChunksManager {
    private numOfChunksX: number;
    private numOfChunksY: number;
    private chunks: Chunk[][] = [];
    private chunkSize: number;

    private objectsChunks: Map<GameObject, Chunk> = new Map<GameObject, Chunk>();
    private objectsManager: GameObjectsManager;
    private objectsFactory: GameObjectsFactory;

    constructor(objectsManager: GameObjectsManager, objectsFactory: GameObjectsFactory) {
        this.objectsManager = objectsManager;
        this.objectsFactory = objectsFactory;
        this.numOfChunksX = objectsFactory.Runtime.config.numOfChunksX;
        this.numOfChunksY = objectsFactory.Runtime.config.numOfChunksY;
        this.chunkSize = objectsFactory.Runtime.config.chunkSize;

        this.initChunks();
        this.setChunksNeighbors();
    }

    get Runtime() {
        return this.objectsFactory.Runtime;
    }

    private initChunks() {
        this.chunks = Array.from({ length: this.numOfChunksX }, (_, x) =>
            Array.from({ length: this.numOfChunksY }, (_, y) => new Chunk(x, y, this.chunkSize, this.objectsFactory)),
        );
    }

    private setChunksNeighbors() {
        for (const [x, column] of this.chunks.entries())
            for (const [y, chunk] of column.entries()) {
                const offsets =
                    x % 2 === 0
                        ? [
                              [0, -1],
                              [-1, -1],
                              [1, -1],
                              [0, 1],
                              [-1, 0],
                              [1, 0],
                          ]
                        : [
                              [0, -1],
                              [-1, 0],
                              [1, 0],
                              [0, 1],
                              [-1, 1],
                              [1, 1],
                          ];
                for (const offset of offsets) {
                    const [dx = 0, dy = 0] = offset;
                    const neighbor = this.chunks[x + dx]?.[y + dy];
                    if (neighbor) chunk.addNeighbor(neighbor);
                }
            }
    }

    private getChunkByCoords(x: number, y: number): Chunk | null {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        if (x < 0 || y < 0 || x >= this.numOfChunksX * this.chunkSize || y >= this.numOfChunksY * this.chunkSize) {
            return null;
        }

        let idxX: number = Math.floor(x / this.chunkSize);

        if (idxX >= this.numOfChunksX || idxX < 0) {
            return null;
        }

        let idxY: number = Math.floor(y / this.chunkSize);
        if (idxX % 2) {
            if (y <= this.chunkSize * 1.5 && y >= 0) {
                idxY = 0;
            } else if (y < this.chunkSize * this.numOfChunksY) {
                idxY = Math.floor((y - this.chunkSize / 2) / this.chunkSize);
            }
        }

        if (idxY >= this.numOfChunksY || idxY < 0) {
            return null;
        }

        // if(SharedConfig.IS_SERVER)
        // console.log("chunk " + [idxX, idxY] + " coords " + [x, y]);

        return this.chunks[idxX]?.[idxY] ?? null;
    }

    public getObjectChunk(gameObject: GameObject): Chunk | undefined {
        return this.objectsChunks.get(gameObject);
    }

    public getChunkAtPosition(x: number, y: number): Chunk | null {
        return this.getChunkByCoords(x, y);
    }

    public addObject(gameObject: GameObject) {
        if (gameObject.IsDestroyed) {
            return;
        }

        const chunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);

        if (!chunk) {
            console.log("Created object outside chunk! " + gameObject.ID + " " + gameObject.Transform.Position);
            gameObject.destroy();
            return;
        }

        if (!chunk.IsActive && !gameObject.IsChunkActivateTriger) {
            console.log(
                "Created not chunk activate triger object in inactive chunk! " +
                    gameObject.ID +
                    " " +
                    [gameObject.Transform.X, gameObject.Transform.Y],
            );
            gameObject.destroy();
            return;
        }

        chunk.addObject(gameObject);
        this.objectsChunks.set(gameObject, chunk);

        if (gameObject.IsChunkFullUpdateTriger) {
            this.setFullUpdateForNewNeighbors(null, chunk);
        }
    }

    public rebuild() {
        this.objectsManager.ObjectsById.forEach((gameObject: GameObject) => {
            this.rebuildOne(gameObject);
        });
    }

    private correctObjectPositionIfOutOfBounds(gameObject: GameObject) {
        if (!Number.isFinite(gameObject.Transform.X)) {
            gameObject.Transform.X = 1;
        }

        if (!Number.isFinite(gameObject.Transform.Y)) {
            gameObject.Transform.Y = 1;
        }

        if (gameObject.Transform.X <= 0) {
            gameObject.Transform.X = 1;
        }

        if (gameObject.Transform.X >= this.numOfChunksX * this.chunkSize) {
            gameObject.Transform.X = this.numOfChunksX * this.chunkSize - 1;
        }

        if (gameObject.Transform.Y <= 0) {
            gameObject.Transform.Y = 1;
        }

        if (gameObject.Transform.Y >= this.numOfChunksY * this.chunkSize) {
            gameObject.Transform.Y = this.numOfChunksY * this.chunkSize - 1;
        }
    }

    public rebuildOne(gameObject: GameObject) {
        let newChunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        const oldChunk = this.objectsChunks.get(gameObject);
        if (!oldChunk || gameObject.IsDestroyed) return;
        if (!newChunk) {
            this.correctObjectPositionIfOutOfBounds(gameObject);
            newChunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        }
        if (!newChunk) throw new Error("Unable to index object inside world bounds");

        if (!newChunk.IsActive && !gameObject.IsChunkActivateTriger) {
            console.log("Object went outside active chunk! " + gameObject.ID);
            oldChunk.addLeaver(gameObject);
            gameObject.destroy();
            return;
        }

        if (oldChunk == newChunk) {
            return;
        }

        if (gameObject.IsChunkFullUpdateTriger) {
            this.setFullUpdateForNewNeighbors(oldChunk, newChunk);
        }

        oldChunk.removeObject(gameObject);
        oldChunk.addLeaver(gameObject);

        newChunk.addObject(gameObject);
        this.objectsChunks.set(gameObject, newChunk);
        gameObject.forceCompleteUpdate();
    }

    private setFullUpdateForNewNeighbors(oldChunk: Chunk | null, newChunk: Chunk) {
        const previous = new Set(oldChunk ? [oldChunk, ...oldChunk.Neighbors] : []);
        for (const chunk of [newChunk, ...newChunk.Neighbors]) {
            if (!previous.has(chunk)) chunk.IsNextUpdateComplete = true;
        }
    }

    public deactivateUnusedChunks() {
        for (let chunk of this.ChunksIterator()) {
            if (chunk.IsDeactivateTimePassed && chunk.IsActive) {
                chunk.deactivate();
            }
        }
    }

    public removeAndReturnOldChunk(gameObject: GameObject): Chunk | null {
        const oldChunk = this.objectsChunks.get(gameObject);
        if (!oldChunk) {
            return null;
        }

        oldChunk.removeObject(gameObject);
        this.objectsChunks.delete(gameObject);
        return oldChunk;
    }

    *ChunksIterator(): Generator<Chunk, void, undefined> {
        for (const column of this.chunks) for (const chunk of column) yield chunk;
    }

    get Chunks(): Chunk[][] {
        return this.chunks;
    }
}
