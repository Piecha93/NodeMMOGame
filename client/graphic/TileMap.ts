/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import Texture = PIXI.Texture;
import Sprite = PIXI.Sprite;

class Chunk extends PIXI.Container {
    x: number;
    y: number;

    size: number;

    constructor(x: number, y: number, size: number) {
        super();

        this.x = x;
        this.y = y;
        this.size = size;
    }
}

export class TileMap extends PIXI.Container {
    // private map: number[][];

    constructor(map?: number[][]) {
        super();

        let chunkSize = 25;

        let chunks: Array<Chunk> = [];

        for(let i = 0; i < 0; i++) {
            for(let j = 0; j < 0; j++) {
                let chunkX = i * 32 * chunkSize;
                let chunkY = j * 32 * chunkSize;

                if(i % 2) {
                    chunkY += chunkSize / 2 * 32;
                }

                chunks.push(new Chunk(chunkX, chunkY, chunkSize));
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
            for(let i = 0; i < chunkSize; i++) {
                for(let j = 0; j < chunkSize; j++) {
                    let sprite: Sprite = new PIXI.Sprite(texture);
                    sprite.x = i*32;
                    sprite.y = j*32;
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


// things = [];
//
// for(var i: number = 0; i < 10; i++) {
//     this.things[i] = [];
//     for(var j: number = 0; j< 10; j++) {
//         this.things[i][j] = new Thing();
//     }
// }