/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import Texture = PIXI.Texture;
import Sprite = PIXI.Sprite;
import {CommonConfig} from "../../common/CommonConfig";
import {GameObject} from "../../common/game_utils/game/GameObject";
import {ChunksManager, Chunk} from "../../common/game_utils/Chunks";

type Coords = [number, number];

class MapChunk extends PIXI.Container {
    x: number;
    y: number;

    sizeX: number;
    sizeY: number;

    mapGrid: number[][];

    constructor(x: number, y: number, sizeX: number, sizeY: number) {
        super();

        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;

        this.mapGrid = [];

        for(let i = 0; i < this.sizeX; i++) {
            this.mapGrid[i] = [];
            for(let j = 0; j < this.sizeY; j++) {
                this.mapGrid[i][j] = Math.floor(Math.random() * 12) * 32;
            }
        }
    }
}

export class TileMap extends PIXI.Container {
    // private map: number[][];

    private mapChunks: MapChunk[][];
    private focusedObject: GameObject;
    private chunksManager: ChunksManager;

    private currentChunkCoords: Coords;
    private visibleMapChunks: Map<Coords, MapChunk>;


    constructor() {
        super();

        this.focusedObject = null;
        this.visibleMapChunks = new Map<Coords, MapChunk>();

        let numOfChunksX = CommonConfig.numOfChunksX;
        let numOfChunksY = CommonConfig.numOfChunksY;

        this.mapChunks = [];

        for(let i = 0; i < numOfChunksX; i++) {
            this.mapChunks[i] = [];
            for(let j = 0; j < numOfChunksY; j++) {
                let chunkSizeX = CommonConfig.chunkSize;
                let chunkSizeY = CommonConfig.chunkSize;

                let chunkX = i * chunkSizeX;
                let chunkY = j * chunkSizeY;

                if(i % 2) {
                    if(j == 0) {
                        chunkSizeY *= 1.5;
                    } else if(j == numOfChunksY - 1) {
                        chunkY += (chunkSizeY / 2);
                        chunkSizeY *= 0.5;
                    }  else {
                        chunkY += (chunkSizeY / 2);
                    }
                }

                this.mapChunks[i][j] = new MapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY);

                this.setChunkTextures(this.mapChunks[i][j]);
            }
        }
    }

    private setChunkTextures(chunk: MapChunk) {
        let texture: Texture = new PIXI.Texture(PIXI.utils.TextureCache['terrain'],
            new PIXI.Rectangle(Math.floor(Math.random() * 12) * 32, Math.floor(Math.random() * 12) * 32, 32, 32));
        for(let i = 0; i < chunk.sizeX / 32; i++) {
            for(let j = 0; j < chunk.sizeY / 32; j++) {
                // let texture: Texture = new PIXI.Texture(PIXI.game_utils.TextureCache['terrain'],
                //     new PIXI.Rectangle(chunk.mapGrid[i][j], chunk.mapGrid[i][j], 32, 32));
                let sprite: Sprite = new PIXI.Sprite(texture);
                sprite.x = i * 32;
                sprite.y = j * 32;
                chunk.addChild(sprite);
            }
        }
        chunk.cacheAsBitmap = true;
    }

    private updateVisibleChunks() {
        // console.log(":OOOOOOOOOOOO" + this.focusedObject);
        let chunk: Chunk = this.chunksManager.getObjectChunk(this.focusedObject);
        // console.log("XDDDDDDDDD");
        if(!chunk) {
            // console.log("Chunk not found");
            return;
        }

        let newChunkCoords: Coords = [chunk.x, chunk.y];

        // console.log("new coords " + newChunkCoords);

        if(newChunkCoords == this.currentChunkCoords) {
            // console.log("coords not changed");
            return;
        }

        this.visibleMapChunks.forEach((mapChunk: MapChunk, coord: Coords, ) => {
            // console.log("remove " + coord);
            this.removeChild(mapChunk);
        });
        this.visibleMapChunks.clear();

        this.currentChunkCoords = newChunkCoords;

        this.addToVisibleMapChunks(this.currentChunkCoords);
        chunk.neighbors.forEach((chunkNeighbor: Chunk) => {
            // console.log("add coords " + [chunkNeighbor.x, chunkNeighbor.y]);
            this.addToVisibleMapChunks([chunkNeighbor.x, chunkNeighbor.y])
        });
    }

    private addToVisibleMapChunks(coords: Coords) {
        let mapChunk: MapChunk = this.mapChunks[coords[0]][coords[1]];
        this.visibleMapChunks.set(coords, mapChunk);
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
