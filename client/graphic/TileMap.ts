/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import Texture = PIXI.Texture;
import Sprite = PIXI.Sprite;
import {CommonConfig} from "../../common/CommonConfig";
import {GameObject} from "../../common/game_utils/game/objects/GameObject";
import {Chunk} from "../../common/game_utils/chunks/Chunk";

type Coords = [number, number];

function compareCoords(c1: Coords, c2: Coords): boolean {
    return c1[0] == c2[0] && c1[1] == c2[1];
}

class TileMapChunk extends PIXI.Container {
    x: number;
    y: number;

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
        let texture: Texture = new PIXI.Texture(PIXI.utils.TextureCache['terrain'],
            new PIXI.Rectangle(1 * 32, 5 * 32, 32, 32));
        for(let i = 0; i < this.sizeX / 32; i++) {
            for(let j = 0; j < this.sizeY / 32; j++) {
                // let texture: Texture = new PIXI.Texture(PIXI.game_utils.TextureCache['terrain'],
                //     new PIXI.Rectangle(chunk.mapGrid[i][j], chunk.mapGrid[i][j], 32, 32));
                let sprite: Sprite = new PIXI.Sprite(texture);
                sprite.x = i * 32;
                sprite.y = j * 32;
                this.addChild(sprite);
            }
        }
        this.cacheAsBitmap = true;
        this.initialized = true;
    }

    get Initialized(): boolean {
        return this.initialized;
    }
}

export class TileMap extends PIXI.Container {
    private mapChunks: TileMapChunk[][];
    private focusedObject: GameObject;
    private currentChunk: Chunk;

    private currentChunkCoords: Coords;
    private visibleMapChunks: Map<Coords, TileMapChunk>;

    private numOfChunksX = CommonConfig.numOfChunksX;
    private numOfChunksY = CommonConfig.numOfChunksY;

    constructor() {
        super();

        this.focusedObject = null;
        this.visibleMapChunks = new Map<Coords, TileMapChunk>();

        this.currentChunkCoords = [-1, -1];

        this.mapChunks = [];

        for (let i = 0; i < this.numOfChunksX; i++) {
            this.mapChunks[i] = [];
            for (let j = 0; j < this.numOfChunksY; j++) {
                let chunkSizeX = CommonConfig.chunkSize;
                let chunkSizeY = CommonConfig.chunkSize;

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

        this.visibleMapChunks.forEach((mapChunk: TileMapChunk, coords: Coords, ) => {
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

    public destroy() {
        for (let i = 0; i < this.numOfChunksX; i++) {
            for (let j = 0; j < this.numOfChunksY; j++) {
                this.mapChunks[i][j].destroy();
            }
        }
        super.destroy();
    }
}
