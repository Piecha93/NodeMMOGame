import {CommonConfig} from "../CommonConfig";

export class MapChunk {
    private mapGrid: number[][];

    constructor() {
        let numOfChunksX = CommonConfig.numOfChunksX;
        let numOfChunksY = CommonConfig.numOfChunksY;

        this.mapGrid = [];

        for(let i = 0; i < numOfChunksX; i++) {
            this.mapGrid[i] = [];
            for(let j = 0; j < numOfChunksY; j++) {
                this.mapGrid[i][j] = Math.floor(Math.random() * 12);
            }
        }
    }
}

export class Map {

    constructor() {

    }
}