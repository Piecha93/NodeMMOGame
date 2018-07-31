import {GameObject} from "../utils/game/GameObject";
import {CommonConfig} from "../CommonConfig";
import {Player} from "./game/Player";


export class ChunksManager {
    private numOfChunksX: number;
    private numOfChunksY: number;
    private chunks: Chunk[][];
    private chunkSize: number;

    private objectsChunks: Map<GameObject, Chunk> = new Map<GameObject, Chunk>();

    constructor() {
        this.numOfChunksX = CommonConfig.numOfChunksX;
        this.numOfChunksY = CommonConfig.numOfChunksY;
        this.chunkSize = CommonConfig.chunkSize;

        this.initChunks();
        this.setChunksNeighbors();
    }

    private initChunks() {
        this.chunks = [];

        for(let i = 0; i < this.numOfChunksX; i++) {
            this.chunks[i] = [];
            for(let j = 0; j < this.numOfChunksY; j++) {
                let chunkX = i * this.chunkSize;
                let chunkY = j * this.chunkSize;

                if (i % 2) {
                    chunkY += this.chunkSize / 2;
                }

                this.chunks[i][j] = new Chunk(chunkX, chunkY, this.chunkSize);
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

    public rebuild(gameObjectsMapById: Map<string, GameObject>) {
        gameObjectsMapById.forEach((object: GameObject) => {
            let chunk: Chunk = this.getChunkByCoords(object.Transform.X, object.Transform.Y);

            if(!chunk) {
                // console.log("Object out of chunks!");;
                return;
            }

            let oldChunk: Chunk = this.objectsChunks.get(object);
            if(oldChunk == chunk) {
                return;
            }

            chunk.addObject(object);
            this.objectsChunks.set(object, chunk);
            object.forceCompleteUpdate();

            if(oldChunk != undefined) {
                oldChunk.removeObject(object);
                oldChunk.addLeaver(object);
            }
        });
    }

    public clearUnusedChunks(player: Player) {
        let playerChunks: Array<Chunk> = [this.objectsChunks.get(player)];
        playerChunks = playerChunks.concat(playerChunks[0].Neighbors);

        for(let i: number = 0; i < this.chunks.length; i++) {
            for (let j: number = 0; j < this.chunks.length; j++) {
                if(playerChunks.indexOf(this.chunks[i][j]) == -1) {
                    this.chunks[i][j].Objects.forEach((gameObject: GameObject) => {
                        gameObject.destroy();
                    });
                }
            }
        }
    }

    remove(gameObject: GameObject) {
        if(this.objectsChunks.has(gameObject)) {
            this.objectsChunks.get(gameObject).removeObject(gameObject);
            this.objectsChunks.delete(gameObject);
        }
    }

    get Chunks(): Chunk[][] {
        return this.chunks;
    }
}

export class Chunk {
    x: number;
    y: number;

    private size: number;

    readonly objects: Array<GameObject>;
    readonly neighbors: Array<Chunk>;
    private leavers: Array<GameObject>;

    private numOfPlayers: number;
    private hasNewcomers: boolean = false;

    constructor(x: number, y: number, size: number) {
        this.x = x;
        this.y = y;
        this.size = size;

        this.objects = [];
        this.neighbors = [];
        this.leavers = [];
        this.numOfPlayers = 0;
    }

    public addNeighbor(neighborChunk: Chunk) {
        this.neighbors.push(neighborChunk);
    }

    public addObject(gameObject: GameObject) {
        this.objects.push(gameObject);

        if(gameObject instanceof Player) {
            this.hasNewcomers = true;
            this.numOfPlayers++;
        }
    }

    public addLeaver(gameObject: GameObject) {
        this.leavers.push(gameObject);
    }

    public resetLeavers() {
        this.leavers = [];
    }

    public removeObject(gameObject: GameObject) {
        let index: number = this.objects.indexOf(gameObject, 0);
        if (index > -1) {
            this.objects.splice(index, 1);
        }

        if(gameObject instanceof Player) {
            this.numOfPlayers--;
        }
    }

    public hasObjectInside(gameObject: GameObject): boolean {
        return this.objects.indexOf(gameObject) != -1;
    }

    public hasObjectInNeighborhood(gameObject: GameObject): boolean {
        if(this.hasObjectInside(gameObject)) {
            return true;
        }

        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(this.neighbors[i].hasObjectInside(gameObject)) {
                return true;
            }
        }

        return false;
    }

    get Objects(): Array<GameObject> {
        return this.objects;
    }

    get HasNewcomers(): boolean {
        return this.hasNewcomers;
    }

    resetHasNewComers() {
        this.hasNewcomers = false;
    }

    get HasNewcomersInNeighborhood(): boolean {
        if(this.HasNewcomers) {
            return true;
        }

        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(this.neighbors[i].HasNewcomers) {
                return true;
            }
        }

        return false;
    }

    get HasPlayers(): boolean {
        return this.numOfPlayers > 0;
    }

    get HasPlayersInNeighborhood(): boolean {
        if(this.HasPlayers) {
            return true;
        }

        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(this.neighbors[i].HasPlayers) {
                return true;
            }
        }

        return false;
    }

    get Neighbors(): Array<Chunk> {
        return this.neighbors;
    }

    get Leavers(): Array<GameObject> {
        return this.leavers;
    }
}