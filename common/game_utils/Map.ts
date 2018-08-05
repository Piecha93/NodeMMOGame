import {CommonConfig} from "../CommonConfig";

export class MapChunk {
    // x: number;
    // y: number;

    private sizeX: number;
    private sizeY: number;

    mapGrid: number[][];

    constructor(x: number, y: number, sizeX: number, sizeY: number) {
        // this.x = x;
        // this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }

    fillRandom() {
        let tileNum: number = Math.floor(Math.random() * 12 * 32);

        this.mapGrid = [];
        for (let i = 0; i < this.sizeX; i++) {
            this.mapGrid[i] = [];
            for (let j = 0; j < this.sizeY; j++) {
                this.mapGrid[i][j] = tileNum;
            }
        }
    }
}

export class Map {
    private mapChunks: MapChunk[][];

    private numOfChunksX: number = CommonConfig.numOfChunksX;
    private numOfChunksY: number = CommonConfig.numOfChunksY;
    private chunkSize: number = CommonConfig.numOfChunksY;

    constructor() {

        this.mapChunks = [];

        for (let i = 0; i < this.numOfChunksX; i++) {
            this.mapChunks[i] = [];
            for (let j = 0; j < this.numOfChunksY; j++) {
                let chunkSizeX = this.chunkSize;
                let chunkSizeY = this.chunkSize;

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

                this.mapChunks[i][j] = new MapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY);
                this.mapChunks[i][j].fillRandom();
            }
        }
    }

    generate() {
        //TO DO XD
    }
}