/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

export class HUD extends PIXI.Container {
    protected sprites: Array<PIXI.Sprite>;

    constructor() {
        super();
        this.sprites = [];

        for(let i = 0; i < 6; i++) {
            let sprite: PIXI.Sprite = new PIXI.Sprite(PIXI.utils.TextureCache["white"]);
            this.addChild(sprite);

            sprite.alpha = 0.1;
            sprite.x = 80 + (i * 100);
            sprite.y = 50;

            sprite.width = 64;
            sprite.height = 64;
            this.sprites.push(sprite);
        }
    }

    public update() {
    }

    public destroy() {
        super.destroy();
    }
}
