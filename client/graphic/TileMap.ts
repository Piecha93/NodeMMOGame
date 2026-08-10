import {Container, Rectangle, Sprite, Texture} from "pixi.js";
import {SharedConfig} from "../../shared/SharedConfig";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {Chunk} from "../../shared/chunks/Chunk";
import {ResourcesLoader} from "./ResourcesLoader";

type Coords = [number, number];

function compareCoords(c1: Coords, c2: Coords): boolean {
    return c1[0] == c2[0] && c1[1] == c2[1];
}

class TileMapChunk extends Container {
    sizeX: number;
    sizeY: number;

    private initialized: boolean = false;

    constructor(x: number, y: number, sizeX: number, sizeY: number) {
        super();

        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }

    initChunkTextures() {
        const terrainTexture = ResourcesLoader.Instance.getResource("terrain").texture;
        if (!terrainTexture) {
            throw new Error("Missing sprite texture: terrain");
        }

        const texture = new Texture({
            source: terrainTexture.source,
            frame: new Rectangle(1 * 32, 5 * 32, 32, 32)
        });
        for(let i = 0; i < this.sizeX / 32; i++) {
            for(let j = 0; j < this.sizeY / 32; j++) {
                const sprite = new Sprite(texture);
                sprite.x = i * 32;
                sprite.y = j * 32;
                this.addChild(sprite);
            }
        }
        this.cacheAsTexture(true);
        this.initialized = true;
    }

    get Initialized(): boolean {
        return this.initialized;
    }
}

export class TileMap extends Container {
    private mapChunks: TileMapChunk[][];
    private focusedObject: GameObject;
    private currentChunk: Chunk;

    private currentChunkCoords: Coords;
    private visibleMapChunks: Map<Coords, TileMapChunk>;

    private numOfChunksX = SharedConfig.numOfChunksX;
    private numOfChunksY = SharedConfig.numOfChunksY;

    constructor() {
        super();

        this.focusedObject = null;
        this.visibleMapChunks = new Map<Coords, TileMapChunk>();

        this.currentChunkCoords = [-1, -1];

        this.mapChunks = [];

        for (let i = 0; i < this.numOfChunksX; i++) {
            this.mapChunks[i] = [];
            for (let j = 0; j < this.numOfChunksY; j++) {
                let chunkSizeX = SharedConfig.chunkSize;
                let chunkSizeY = SharedConfig.chunkSize;

                let chunkX = i * chunkSizeX;
                let chunkY = j * chunkSizeY;

                if (i % 2) {
                    if (j == 0) {
                        chunkSizeY *= 1.5;
                    } else if (j == this.numOfChunksY - 1) {
                        chunkY += (chunkSizeY / 2);
                        chunkSizeY *= 0.5;
                    } else {
                        chunkY += (chunkSizeY / 2);
                    }
                }
                this.mapChunks[i][j] = new TileMapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY);
            }
        }
    }

    private updateVisibleChunks() {
        if(!this.currentChunk) {
            return;
        }

        let newChunkCoords: Coords = [this.currentChunk.x, this.currentChunk.y];

        if(compareCoords(newChunkCoords, this.currentChunkCoords)) {
            return;
        }

        this.currentChunkCoords = newChunkCoords;

        let newCoordsArr: Array<Coords> = [];
        newCoordsArr.push(newChunkCoords);

        this.currentChunk.neighbors.forEach((chunkNeighbor: Chunk) => {
            newCoordsArr.push([chunkNeighbor.x, chunkNeighbor.y]);
        });

        this.visibleMapChunks.forEach((mapChunk: TileMapChunk, coords: Coords) => {
            let idx: number = -1;
            for(let i = 0; i < newCoordsArr.length; i++) {
                if(compareCoords(newCoordsArr[i], coords)) {
                    idx = i;
                    break;
                }
            }
            if(idx == -1) {
                this.removeChild(mapChunk);
                this.visibleMapChunks.delete(coords);
            } else {
                newCoordsArr.splice(idx, 1)
            }
        });

        newCoordsArr.forEach((coords: Coords) => {
            this.addToVisibleMapChunks(coords);
        });
        }

    private addToVisibleMapChunks(coords: Coords) {
        let mapChunk: TileMapChunk = this.mapChunks[coords[0]][coords[1]];
        this.visibleMapChunks.set(coords, mapChunk);

        if(!mapChunk.Initialized) {
            mapChunk.initChunkTextures();
        }
        this.addChild(mapChunk);
    }

    set FocusedObject(gameObject: GameObject) {
        this.focusedObject = gameObject;
        this.updateVisibleChunks();
    }

    set CurrentChunk(chunk: Chunk) {
        this.currentChunk = chunk;
    }

    public update() {
        this.updateVisibleChunks();
    }

    public destroy(): void {
        for (let i = 0; i < this.numOfChunksX; i++) {
            for (let j = 0; j < this.numOfChunksY; j++) {
                this.mapChunks[i][j].destroy({children: true});
            }
        }
        super.destroy();
    }
}
