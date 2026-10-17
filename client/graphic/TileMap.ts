import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { SharedConfig } from "../../shared/SharedConfig";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Chunk } from "../../shared/chunks/Chunk";
import { ResourcesLoader } from "./ResourcesLoader";
import { villageTileAt, VILLAGE_TILE_SIZE } from "../../shared/gameplay/VillageMap";

type Coords = [number, number];
export interface TileMapConfig {
    numOfChunksX: number;
    numOfChunksY: number;
    chunkSize: number;
    terrain?: "legacy" | "village";
}

function compareCoords(c1: Coords, c2: Coords): boolean {
    return c1[0] == c2[0] && c1[1] == c2[1];
}

class TileMapChunk extends Container {
    sizeX: number;
    sizeY: number;

    private initialized: boolean = false;
    private terrainFrame: Texture | null = null;

    constructor(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        private readonly terrain: "legacy" | "village" = "legacy",
    ) {
        super();

        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }

    initChunkTextures() {
        if (this.terrain === "village") {
            const ground = new Graphics();
            drawVillageGround(ground, this.x, this.y, this.sizeX, this.sizeY);
            this.addChild(ground);
            this.cacheAsTexture(true);
            this.initialized = true;
            return;
        }
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
                column.push(new TileMapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY, config.terrain));
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

/** Build once per visible chunk; shared tile coordinates keep shores continuous at seams. */
export function drawVillageGround(
    ground: Graphics,
    originX: number,
    originY: number,
    width: number,
    height: number,
): void {
    const grass = [0x5e8352, 0x608554, 0x638756, 0x5f8453] as const;
    const dirt = [0xb39c70, 0xb6a075, 0xb29a6d, 0xb9a276] as const;
    const water = [0x397e9c, 0x3b809e, 0x3a819f, 0x3d83a0] as const;
    const tileSize = VILLAGE_TILE_SIZE;
    for (let localY = 0; localY < height; localY += tileSize) {
        for (let localX = 0; localX < width; localX += tileSize) {
            const tile = villageTileAt(
                Math.floor((originX + localX) / tileSize),
                Math.floor((originY + localY) / tileSize),
            );
            const variant = tile.variant;
            if (tile.kind === "water") {
                ground.rect(localX, localY, tileSize, tileSize).fill(water[variant] ?? water[0]);
                if (tile.shore & 1)
                    ground
                        .rect(localX, localY, tileSize, 5)
                        .fill(0xa7b88a)
                        .rect(localX, localY + 5, tileSize, 2)
                        .fill(0x9bd1c0);
                if (tile.shore & 2)
                    ground
                        .rect(localX + 27, localY, 5, tileSize)
                        .fill(0xa7b88a)
                        .rect(localX + 25, localY, 2, tileSize)
                        .fill(0x9bd1c0);
                if (tile.shore & 4)
                    ground
                        .rect(localX, localY + 27, tileSize, 5)
                        .fill(0xa7b88a)
                        .rect(localX, localY + 25, tileSize, 2)
                        .fill(0x9bd1c0);
                if (tile.shore & 8)
                    ground
                        .rect(localX, localY, 5, tileSize)
                        .fill(0xa7b88a)
                        .rect(localX + 5, localY, 2, tileSize)
                        .fill(0x9bd1c0);
                ground.rect(localX + 11, localY + 12 + variant, 7, 1).fill({ color: 0x9ecbd1, alpha: 0.4 });
                if (variant === 0) ground.rect(localX + 16, localY + 21, 5, 1).fill({ color: 0xb7dee0, alpha: 0.35 });
            } else if (tile.kind === "bridge") {
                ground.rect(localX, localY, tileSize, tileSize).fill(0x8a653f);
                for (let plank = 0; plank < 4; plank++) {
                    ground.rect(localX + plank * 8, localY + 1, 7, tileSize - 2).fill(plank % 2 ? 0xb38c58 : 0xc09761);
                    ground.rect(localX + plank * 8 + 2, localY + 7, 1, 1).fill(0x5f492e);
                }
            } else {
                const path = tile.kind === "path";
                ground.rect(localX, localY, tileSize, tileSize).fill((path ? dirt : grass)[variant] ?? grass[0]);
                if (path) {
                    ground.ellipse(localX + 8 + variant * 3, localY + 9, 2, 1).fill({ color: 0x8c7c58, alpha: 0.3 });
                    ground.rect(localX + 23, localY + 22, 2, 1).fill({ color: 0xe4cf9c, alpha: 0.35 });
                } else {
                    ground
                        .moveTo(localX + 6, localY + 11)
                        .lineTo(localX + 5, localY + 8)
                        .moveTo(localX + 6, localY + 11)
                        .lineTo(localX + 8, localY + 7)
                        .stroke({ color: 0x426f43, width: 1, alpha: 0.4 });
                    ground.rect(localX + 18 + variant, localY + 23, 2, 1).fill({ color: 0x91a765, alpha: 0.5 });
                }
            }
        }
    }
}
