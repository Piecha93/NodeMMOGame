/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import Texture = PIXI.Texture;
import Sprite = PIXI.Sprite;

export class TileMap extends PIXI.Container {
    private map: number[][];

    constructor(map?: number[][]) {
        super();

        this.map = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];

        let texture: Texture = new PIXI.Texture(PIXI.utils.TextureCache['terrain'], new PIXI.Rectangle(6*32, 12*32, 32, 32));

        for(let i = 0; i < 100; i++) {
            for(let j = 0; j < 100; j++) {
                let sprite: Sprite = new PIXI.Sprite(texture);
                sprite.x = i*32;
                sprite.y = j*32;
                this.addChild(sprite);
            }
        }
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