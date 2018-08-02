/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import Texture = PIXI.Texture;
import Sprite = PIXI.Sprite;
import {CommonConfig} from "../../common/CommonConfig";
import {GameObject} from "../../common/game_utils/game/GameObject";
import {ChunksManager, Chunk} from "../../common/game_utils/Chunks";

type Coords = [number, number];

function compareCoords(c1: Coords, c2: Coords): boolean {
    return c1[0] == c2[0] && c1[1] == c2[1];
}

class MapChunk extends PIXI.Container {
    x: number;
    y: number;

    sizeX: number;
    sizeY: number;

    mapGrid: number[][];

    private initialized: boolean = false;

    constructor(x: number, y: number, sizeX: number, sizeY: number) {
        super();

        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;

        this.mapGrid = [];

        // for(let i = 0; i < this.sizeX; i++) {
        //     this.mapGrid[i] = [];
        //     for(let j = 0; j < this.sizeY; j++) {
        //         this.mapGrid[i][j] = Math.floor(Math.random() * 12) * 32;
        //     }
        // }
    }

    initChunkTextures() {
        let texture: Texture = new PIXI.Texture(PIXI.utils.TextureCache['terrain'],
            new PIXI.Rectangle(Math.floor(Math.random() * 12) * 32, Math.floor(Math.random() * 12) * 32, 32, 32));
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
    private mapChunks: MapChunk[][];
    private focusedObject: GameObject;
    private chunksManager: ChunksManager;

    private currentChunkCoords: Coords;
    private visibleMapChunks: Map<Coords, MapChunk>;


    constructor() {
        super();

        this.focusedObject = null;
        this.visibleMapChunks = new Map<Coords, MapChunk>();

        this.currentChunkCoords = [-1, -1];

        let numOfChunksX = CommonConfig.numOfChunksX;
        let numOfChunksY = CommonConfig.numOfChunksY;

        this.mapChunks = [];

        for (let i = 0; i < numOfChunksX; i++) {
            this.mapChunks[i] = [];
            for (let j = 0; j < numOfChunksY; j++) {
                let chunkSizeX = CommonConfig.chunkSize;
                let chunkSizeY = CommonConfig.chunkSize;

                let chunkX = i * chunkSizeX;
                let chunkY = j * chunkSizeY;

                if (i % 2) {
                    if (j == 0) {
                        chunkSizeY *= 1.5;
                    } else if (j == numOfChunksY - 1) {
                        chunkY += (chunkSizeY / 2);
                        chunkSizeY *= 0.5;
                    } else {
                        chunkY += (chunkSizeY / 2);
                    }
                }

                this.mapChunks[i][j] = new MapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY);
            }
        }
    }

    private updateVisibleChunks() {
        let chunk: Chunk = this.chunksManager.getObjectChunk(this.focusedObject);
        if(!chunk) {
            return;
        }

        let newChunkCoords: Coords = [chunk.x, chunk.y];

        if(compareCoords(newChunkCoords, this.currentChunkCoords)) {
            return;
        }

        this.currentChunkCoords = newChunkCoords;

        let newCoordsArr: Array<Coords> = [];
        newCoordsArr.push(newChunkCoords);

        chunk.neighbors.forEach((chunkNeighbor: Chunk) => {
            newCoordsArr.push([chunkNeighbor.x, chunkNeighbor.y]);
        });

        this.visibleMapChunks.forEach((mapChunk: MapChunk, coords: Coords, ) => {
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
        let mapChunk: MapChunk = this.mapChunks[coords[0]][coords[1]];
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

    set ChunksManager(chunksManager: ChunksManager) {
        this.chunksManager = chunksManager;
    }

    public update() {
        this.updateVisibleChunks();
    }

    public destroy() {
        super.destroy();
    }
}
