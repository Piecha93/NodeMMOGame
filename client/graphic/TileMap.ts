/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import Texture = PIXI.Texture;
import Sprite = PIXI.Sprite;
import {CommonConfig} from "../../common/CommonConfig";

class Chunk extends PIXI.Container {
    x: number;
    y: number;

    sizeX: number;
    sizeY: number;

    constructor(x: number, y: number, sizeX: number, sizeY: number) {
        super();

        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }
}

export class TileMap extends PIXI.Container {
    // private map: number[][];

    constructor(map?: number[][]) {
        super();

        let numOfChunksX = CommonConfig.numOfChunksX;
        let numOfChunksY = CommonConfig.numOfChunksY;

        let chunks: Array<Chunk> = [];

        for(let i = 0; i < numOfChunksX; i++) {
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

                chunks.push(new Chunk(chunkX, chunkY, chunkSizeX, chunkSizeY));
            }
        }

        // this.map = [
        //     [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        //     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        //     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        //     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        //     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        //     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        //     [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        // ];

        chunks.forEach((chunk: Chunk) => {
            let texture: Texture = new PIXI.Texture(PIXI.utils.TextureCache['terrain'], new PIXI.Rectangle(Math.random()*12*32, Math.random()*12*32, 32, 32));
            for(let i = 0; i < chunk.sizeX; i+=32) {
                for(let j = 0; j < chunk.sizeY; j+=32) {
                    let sprite: Sprite = new PIXI.Sprite(texture);
                    sprite.x = i;
                    sprite.y = j;
                    chunk.addChild(sprite);
                }
            }
            chunk.cacheAsBitmap = true;
            this.addChild(chunk);
        });
    }

    public update() {

    }

    public destroy() {
        super.destroy();
    }
}
