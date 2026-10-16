import { WorldContext } from "../core/WorldContext";

export class MapChunk {
    // x: number;
    // y: number;

    private sizeX: number;
    private sizeY: number;

    mapGrid: number[][] = [];

    constructor(x: number, y: number, sizeX: number, sizeY: number) {
        // this.x = x;
        // this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }

    fillRandom(random: () => number = Math.random) {
        let tileNum: number = Math.floor(random() * 12 * 32);

        this.mapGrid = Array.from({ length: this.sizeX }, () => Array<number>(this.sizeY).fill(tileNum));
    }
}

export class Map {
    private mapChunks: MapChunk[][];

    private numOfChunksX: number;
    private numOfChunksY: number;
    private chunkSize: number;

    constructor(runtime: WorldContext = new WorldContext()) {
        this.numOfChunksX = runtime.config.numOfChunksX;
        this.numOfChunksY = runtime.config.numOfChunksY;
        this.chunkSize = runtime.config.chunkSize;

        this.mapChunks = [];

        for (let i = 0; i < this.numOfChunksX; i++) {
            const column: MapChunk[] = [];
            this.mapChunks.push(column);
            for (let j = 0; j < this.numOfChunksY; j++) {
                let chunkSizeX = this.chunkSize;
                let chunkSizeY = this.chunkSize;

                let chunkX = i * chunkSizeX;
                let chunkY = j * chunkSizeY;

                if (i % 2) {
                    if (j == 0) {
                        chunkSizeY *= 1.5;
                    } else if (j == this.numOfChunksY - 1) {
                        chunkY += chunkSizeY / 2;
                        chunkSizeY *= 0.5;
                    } else {
                        chunkY += chunkSizeY / 2;
                    }
                }

                const chunk = new MapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY);
                chunk.fillRandom(runtime.random);
                column.push(chunk);
            }
        }
    }

    generate() {
        //TO DO XD
    }
}
