import {GameObjectsSubscriber} from "../game_utils/factory/GameObjectsSubscriber";
import {GameObject} from "../game_utils/game/objects/GameObject";
import {SharedConfig} from "../SharedConfig";
import {Chunk} from "./Chunk";
import {ChangesDict} from "../serialize/ChangesDict";


export class ChunksManager extends GameObjectsSubscriber {
    private numOfChunksX: number;
    private numOfChunksY: number;
    private chunks: Chunk[][];
    private chunkSize: number;

    private objectsChunks: Map<GameObject, Chunk> = new Map<GameObject, Chunk>();

    constructor() {
        super();

        this.numOfChunksX = SharedConfig.numOfChunksX;
        this.numOfChunksY = SharedConfig.numOfChunksY;
        this.chunkSize = SharedConfig.chunkSize;

        this.initChunks();
        this.setChunksNeighbors();
    }

    private initChunks() {
        this.chunks = [];

        for(let i = 0; i < this.numOfChunksX; i++) {
            this.chunks[i] = [];
            for(let j = 0; j < this.numOfChunksY; j++) {
                this.chunks[i][j] = new Chunk(i, j, this.chunkSize);
            }
        }
    }

    private setChunksNeighbors() {
        for(let i: number = 0; i < this.chunks.length; i++) {
            for (let j: number = 0; j < this.chunks.length; j++) {
                let isShifted: boolean = (i % 2) != 0;

                let isFirstInCloumn: boolean = j == 0;
                let isLastInCloumn: boolean = j == (this.numOfChunksY - 1);

                let isFirstInRow: boolean = i == 0;
                let isLastInRow: boolean = i == (this.numOfChunksX - 1);

                let neighborsMap: Map<string, [number, number]>;

                if (isShifted) {
                    neighborsMap = new Map<string, [number, number]>([
                        ["U",  [i,   j-1]],
                        ["UL", [i-1, j]],
                        ["UR", [i+1, j]],

                        ["D",  [i,   j+1]],
                        ["DL", [i-1, j+1]],
                        ["DR", [i+1, j+1]]
                    ]);
                } else {
                    neighborsMap = new Map<string, [number, number]>([
                        ["U",  [i,   j-1]],
                        ["UL", [i-1, j-1]],
                        ["UR", [i+1, j-1]],

                        ["D",  [i,   j+1]],
                        ["DL", [i-1, j]],
                        ["DR", [i+1, j]]
                    ]);
                }

                if (isFirstInRow) {
                    neighborsMap.delete("DL");
                    neighborsMap.delete("UL");
                }

                if (isLastInRow) {
                    neighborsMap.delete("DR");
                    neighborsMap.delete("UR");
                }

                if (isFirstInCloumn) {
                    neighborsMap.delete("U");
                    if (!isShifted) {
                        neighborsMap.delete("UL");
                        neighborsMap.delete("UR");
                    }
                }

                if (isLastInCloumn) {
                    neighborsMap.delete("D");
                    if (isShifted) {
                        neighborsMap.delete("DL");
                        neighborsMap.delete("DR");
                    }
                }

                neighborsMap.forEach((neighborIdx: [number, number], key: string) => {
                    this.chunks[i][j].addNeighbor(this.chunks[neighborIdx[0]][neighborIdx[1]]);
                });

            }
        }
    }

    private getChunkByCoords(x: number, y: number): Chunk {
        let idxX: number = Math.floor(x / this.chunkSize);

        if(idxX >= this.numOfChunksX || idxX < 0) {
            return null;
        }

        let idxY: number = Math.floor(y / this.chunkSize);
        if(idxX % 2) {
            if(y <= this.chunkSize * 1.5 && y >= 0) {
                idxY = 0;
            } else if(y < this.chunkSize * this.numOfChunksY) {
                idxY = Math.floor((y - this.chunkSize / 2) / this.chunkSize);
            }
        }

        if(idxY >= this.numOfChunksY || idxY < 0) {
            return null;
        }

        // if(SharedConfig.IS_SERVER)
            // console.log("chunk " + [idxX, idxY] + " coords " + [x, y]);

        return this.chunks[idxX][idxY];
    }

    public getObjectChunk(gameObject: GameObject): Chunk {
        let chunk: Chunk = this.objectsChunks.get(gameObject);
        if(!chunk) {
            this.correctObjectPositionIfOutOfBounds(gameObject);
            return this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        }
        return this.objectsChunks.get(gameObject);
    }

    public onObjectCreate(gameObject: GameObject) {
        if(gameObject.IsDestroyed) {
            return;
        }

        let chunk: Chunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);

        if(!chunk) {
            console.log("Created object outside chunk! " + gameObject.ID + " " + gameObject.Transform.Position);
            gameObject.destroy();
            return;
        }

        if(!chunk.IsActive && !gameObject.IsChunkActivateTriger) {
            console.log("Created not chunk activate triger object in inactive chunk! "
                + gameObject.ID + " " + [gameObject.Transform.X, gameObject.Transform.Y]);
            gameObject.destroy();
            return;
        }

        chunk.addObject(gameObject);
        this.objectsChunks.set(gameObject, chunk);

        if(gameObject.IsChunkFullUpdateTriger) {
            this.setFullUpdateForNewNeighbors(null, chunk);
        }
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.remove(gameObject);
    }

    public rebuild() {
        this.GameObjectsMapById.forEach((gameObject: GameObject) => {
            this.rebuildOne(gameObject);
        });
    }

    private correctObjectPositionIfOutOfBounds(gameObject: GameObject) {
        if(gameObject.Transform.X <= 0) {
            gameObject.Transform.X = 1;
        }

        if(gameObject.Transform.X >= this.numOfChunksX * this.chunkSize) {
            gameObject.Transform.X = this.numOfChunksX * this.chunkSize - 1;
        }

        if(gameObject.Transform.Y <= 0) {
            gameObject.Transform.Y = 1;
        }

        if(gameObject.Transform.Y >= this.numOfChunksY * this.chunkSize) {
            gameObject.Transform.Y = this.numOfChunksY * this.chunkSize - 1;
        }
    }

    public rebuildOne(gameObject: GameObject) {
        if((!gameObject.Transform.hasChange(ChangesDict.X) && !gameObject.Transform.hasChange(ChangesDict.Y))) {
            //chunk cannot change if object did not move
            return;
        }

        let newChunk: Chunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        let oldChunk: Chunk = this.objectsChunks.get(gameObject);

        if(!newChunk) {
            this.correctObjectPositionIfOutOfBounds(gameObject);
            newChunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        }

        if(!newChunk.IsActive && !gameObject.IsChunkActivateTriger) {
            console.log("Object went outside active chunk! " + gameObject.ID);
            oldChunk.addLeaver(gameObject);
            gameObject.destroy();
            return;
        }

        if(oldChunk == newChunk) {
            return;
        }

        if(gameObject.IsChunkFullUpdateTriger) {
            this.setFullUpdateForNewNeighbors(oldChunk, newChunk);
        }

        oldChunk.removeObject(gameObject);
        oldChunk.addLeaver(gameObject);

        newChunk.addObject(gameObject);
        this.objectsChunks.set(gameObject, newChunk);
        gameObject.forceCompleteUpdate();
    }

    private setFullUpdateForNewNeighbors(oldChunk: Chunk, newChunk: Chunk) {
        //need to clone newNeighbors, because it could be modified
        let newNeighbors: Array<Chunk> = Object.assign([], newChunk.Neighbors);

        if(oldChunk) {
            let oldNeighbors: Array<Chunk> = oldChunk.Neighbors;

            let oldInNewIdx: number = newNeighbors.indexOf(oldChunk);
            if (oldInNewIdx != -1) {
                newNeighbors.splice(oldInNewIdx, 1);
            }

            for (let i: number = 0; i < oldNeighbors.length; i++) {
                let oldInNewIdx: number = newNeighbors.indexOf(oldNeighbors[i]);
                if (oldInNewIdx != -1) {
                    newNeighbors.splice(oldInNewIdx, 1);
                }
            }
        } else {
            newChunk.IsNextUpdateComplete = true;
        }

        for(let i: number = 0; i < newNeighbors.length; i++) {
            newNeighbors[i].IsNextUpdateComplete = true;
        }
    }

    public deactivateUnusedChunks() {
        for(let chunk of this.ChunksIterator()) {
            if (chunk.IsDeactivateTimePassed && chunk.IsActive) {
                chunk.deactivate();
            }
        }
    }

    private remove(gameObject: GameObject) {
        if(this.objectsChunks.has(gameObject)) {
            this.objectsChunks.get(gameObject).removeObject(gameObject);
            this.objectsChunks.delete(gameObject);
        }
    }

    *ChunksIterator() {
        for(let i: number = 0; i < this.chunks.length; i++) {
            for (let j: number = 0; j < this.chunks.length; j++) {
                yield this.chunks[i][j];
            }
        }
    }

    get Chunks(): Chunk[][] {
        return this.chunks;
    }
}