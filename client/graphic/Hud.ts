import {Container, Sprite} from "pixi.js";

export class HUD extends Container {
    protected sprites: Array<Sprite>;

    constructor() {
        super();
        this.sprites = [];
    }

    public update() {
    }

}
