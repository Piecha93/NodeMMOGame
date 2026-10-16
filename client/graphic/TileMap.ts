import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import { SharedConfig } from "../../shared/SharedConfig";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Chunk } from "../../shared/chunks/Chunk";
import { ResourcesLoader } from "./ResourcesLoader";

type Coords = [number, number];
export interface TileMapConfig {
    numOfChunksX: number;
    numOfChunksY: number;
    chunkSize: number;
}

function compareCoords(c1: Coords, c2: Coords): boolean {
    return c1[0] == c2[0] && c1[1] == c2[1];
}

class TileMapChunk extends Container {
    sizeX: number;
    sizeY: number;

    private initialized: boolean = false;
    private terrainFrame: Texture | null = null;

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
            frame: new Rectangle(1 * 32, 5 * 32, 32, 32),
        });
        this.terrainFrame = texture;
        for (let i = 0; i < this.sizeX / 32; i++) {
            for (let j = 0; j < this.sizeY / 32; j++) {
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

    public destroy(options?: Parameters<Container["destroy"]>[0]): void {
        if (this.destroyed) return;
        super.destroy(options ?? { children: true });
        this.terrainFrame?.destroy(false);
        this.terrainFrame = null;
    }
}

export class TileMap extends Container {
    private mapChunks: TileMapChunk[][];
    private currentChunk: Chunk | null = null;

    private currentChunkCoords: Coords;
    private visibleMapChunks: Map<Coords, TileMapChunk>;

    constructor(config: TileMapConfig = SharedConfig) {
        super();
        this.visibleMapChunks = new Map<Coords, TileMapChunk>();

        this.currentChunkCoords = [-1, -1];

        this.mapChunks = [];

        for (let i = 0; i < config.numOfChunksX; i++) {
            const column: TileMapChunk[] = [];
            this.mapChunks.push(column);
            for (let j = 0; j < config.numOfChunksY; j++) {
                let chunkSizeX = config.chunkSize;
                let chunkSizeY = config.chunkSize;

                let chunkX = i * chunkSizeX;
                let chunkY = j * chunkSizeY;

                if (i % 2) {
                    if (j == 0) {
                        chunkSizeY *= 1.5;
                    } else if (j == config.numOfChunksY - 1) {
                        chunkY += chunkSizeY / 2;
                        chunkSizeY *= 0.5;
                    } else {
                        chunkY += chunkSizeY / 2;
                    }
                }
                column.push(new TileMapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY));
            }
        }
    }

    private updateVisibleChunks() {
        if (!this.currentChunk) {
            return;
        }

        let newChunkCoords: Coords = [this.currentChunk.x, this.currentChunk.y];

        if (compareCoords(newChunkCoords, this.currentChunkCoords)) {
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
            for (let i = 0; i < newCoordsArr.length; i++) {
                const candidate = newCoordsArr[i];
                if (candidate && compareCoords(candidate, coords)) {
                    idx = i;
                    break;
                }
            }
            if (idx == -1) {
                this.removeChild(mapChunk);
                this.visibleMapChunks.delete(coords);
            } else {
                newCoordsArr.splice(idx, 1);
            }
        });

        newCoordsArr.forEach((coords: Coords) => {
            this.addToVisibleMapChunks(coords);
        });
    }

    private addToVisibleMapChunks(coords: Coords) {
        const mapChunk = this.mapChunks[coords[0]]?.[coords[1]];
        if (!mapChunk) throw new Error(`Missing terrain chunk: ${coords.join(",")}`);
        this.visibleMapChunks.set(coords, mapChunk);

        if (!mapChunk.Initialized) {
            mapChunk.initChunkTextures();
        }
        this.addChild(mapChunk);
    }

    set FocusedObject(_gameObject: GameObject) {
        this.updateVisibleChunks();
    }

    set CurrentChunk(chunk: Chunk) {
        this.currentChunk = chunk;
    }

    public update() {
        this.updateVisibleChunks();
    }

    public destroy(): void {
        if (this.destroyed) return;
        for (const column of this.mapChunks) for (const chunk of column) chunk.destroy({ children: true });
        super.destroy();
    }
}
