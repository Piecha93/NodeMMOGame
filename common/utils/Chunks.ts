import {GameObject} from "../utils/game/GameObject";
import {CommonConfig} from "../CommonConfig";
import {Player} from "./game/Player";


export class ChunksManager {
    private numOfChunksX: number;
    private numOfChunksY: number;
    private chunks: Array<Chunk>;
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
            for(let j = 0; j < this.numOfChunksY; j++) {
                let chunkX = i * 32 * this.chunkSize;
                let chunkY = j * 32 * this.chunkSize;

                if (i % 2) {
                    chunkY += this.chunkSize / 2 * 32;
                }

                this.chunks.push(new Chunk(chunkX, chunkY, this.chunkSize));
            }
        }
    }

    private setChunksNeighbors() {
        for(let i: number = 0; i < this.chunks.length; i++) {
            let isShifted: boolean = (i % (this.numOfChunksY * 2)) >= this.numOfChunksY;

            let isFirstInCloumn: boolean = i % this.numOfChunksY == 0;
            let isLastInCloumn: boolean = i % this.numOfChunksY == this.numOfChunksY - 1;

            let isFirstInRow: boolean = i < this.numOfChunksX;
            let isLastInRow: boolean = i >= this.numOfChunksX * (this.numOfChunksY - 1);

            let neighborsMap: Map<string, number>;

            if(isShifted) {
                neighborsMap = new Map<string, number>([
                    ["U",  i - 1],
                    ["UL", i - this.numOfChunksY],
                    ["UR", i + this.numOfChunksY],

                    ["D",  i + 1],
                    ["DL", i - this.numOfChunksY + 1],
                    ["DR", i + this.numOfChunksY + 1],
                ]);
            } else {
                neighborsMap = new Map<string, number>([
                    ["U",  i - 1],
                    ["UL", i - this.numOfChunksY - 1],
                    ["UR", i + this.numOfChunksY - 1],

                    ["D",  i + 1],
                    ["DL", i - this.numOfChunksY],
                    ["DR", i + this.numOfChunksY],
                ]);
            }

            if(isFirstInRow) {
                neighborsMap.delete("DL");
                neighborsMap.delete("UL");
            }

            if(isLastInRow) {
                neighborsMap.delete("DR");
                neighborsMap.delete("UR");
            }

            if(isFirstInCloumn) {
                neighborsMap.delete("U");
                if(!isShifted) {
                    neighborsMap.delete("UL");
                    neighborsMap.delete("UR");
                }
            }

            if(isLastInCloumn) {
                neighborsMap.delete("D");
                if(isShifted) {
                    neighborsMap.delete("DL");
                    neighborsMap.delete("DR");
                }
            }

            let neigh: string = "";
            neighborsMap.forEach((neighborIdx: number, key: string) => {
                this.chunks[i].addNeighbor(this.chunks[neighborIdx]);
                neigh += neighborIdx + " " + key + ", ";
            });
        }
    }

    public getChunkByCoords(x: number, y: number): Chunk {
        if(x > this.numOfChunksX * this.chunkSize * 32 ||
           y > this.numOfChunksY * this.chunkSize * 32 ||
           x < 0 || y < 0) {
            return null;
        }
        let idxX = Math.ceil(x / this.chunkSize / 32) - 1;

        if(idxX % 2) {
            y -= this.chunkSize / 2 * 32;
        }
        let idxY = Math.ceil(y / this.chunkSize / 32) - 1;

        return this.chunks[idxX * this.numOfChunksY + idxY];
    }

    public getObjectChunk(gameObject: GameObject): Chunk {
        return this.objectsChunks.get(gameObject);
    }

    public rebuild(gameObjectsMapById: Map<string, GameObject>) {
        gameObjectsMapById.forEach((object: GameObject) => {
            let chunk: Chunk = this.getChunkByCoords(object.Transform.X, object.Transform.Y);

            if(!chunk) {
                // console.log("Object out of chunks!");
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
            }
        });
    }

    public clearUnusedChunks(player: Player) {
        let playerChunks: Array<Chunk> = [this.objectsChunks.get(player)];
        playerChunks = playerChunks.concat(playerChunks[0].Neighbors);

        this.chunks.forEach((chunk: Chunk) => {
            if(playerChunks.indexOf(chunk) == -1) {
                chunk.Objects.forEach((gameObject: GameObject) => {
                    gameObject.destroy();
                });
            }
        });
    }

    remove(gameObject: GameObject) {
        if(this.objectsChunks.has(gameObject)) {
            this.objectsChunks.get(gameObject).removeObject(gameObject);
            this.objectsChunks.delete(gameObject);
        }
    }

    get Chunks(): Array<Chunk> {
        return this.chunks;
    }
}

export class Chunk {
    x: number;
    y: number;

    private size: number;

    readonly objects: Array<GameObject>;
    readonly neighbors: Array<Chunk>;

    private numOfPlayers: number;
    private hasNewcomers: boolean = false;

    constructor(x: number, y: number, size: number) {
        this.x = x;
        this.y = y;
        this.size = size;

        this.objects = [];
        this.neighbors = [];
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
}