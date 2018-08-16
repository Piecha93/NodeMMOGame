import {GameObjectsSubscriber} from "../factory/GameObjectsSubscriber";
import {GameObject} from "../game/objects/GameObject";
import {SharedConfig} from "../../SharedConfig";
import {Chunk} from "./Chunk";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Player} from "../game/objects/Player";


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

    public getChunkByCoords(x: number, y: number): Chunk {
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

        // console.log("chunk " + [idxX, idxY] + " coords " + [x, y]);

        return this.chunks[idxX][idxY];
    }

    public getObjectChunk(gameObject: GameObject): Chunk {
        return this.objectsChunks.get(gameObject);
    }

    public onObjectCreate(gameObject: GameObject) {
        let chunk: Chunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);

        if(!chunk) {
            console.log("Created object outside chunk! "
                + gameObject.ID + " " + [gameObject.Transform.X, gameObject.Transform.Y]);
            gameObject.destroy();
            return;
        }

        if(!chunk.IsDeactivateTimePassed && !(gameObject instanceof Player)) {
            console.log("Created not Player object in inactive chunk! "
                + gameObject.ID + " " + [gameObject.Transform.X, gameObject.Transform.Y]);
            gameObject.destroy();
            return;
        }

        chunk.addObject(gameObject);
        this.objectsChunks.set(gameObject, chunk);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.remove(gameObject);
    }

    public rebuild() {
        this.GameObjectsMapById.forEach((gameObject: GameObject) => {
            if((!gameObject.Transform.hasChange(ChangesDict.X) && !gameObject.Transform.hasChange(ChangesDict.Y))) {
                //chunk cannot change if object did not move
                return;
            }

            let chunk: Chunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);

            let oldChunk: Chunk = this.objectsChunks.get(gameObject);

            if(!chunk || (!chunk.IsDeactivateTimePassed && !(gameObject instanceof Player))) {
                // console.log("Object went outside chunk! " + object.ID);
                if(oldChunk) {
                    oldChunk.addLeaver(gameObject);
                }
                gameObject.destroy();
                return;
            }

            if(oldChunk == chunk) {
                return;
            }

            oldChunk.removeObject(gameObject);
            oldChunk.addLeaver(gameObject);

            chunk.addObject(gameObject);
            this.objectsChunks.set(gameObject, chunk);
            gameObject.forceCompleteUpdate();
        });
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