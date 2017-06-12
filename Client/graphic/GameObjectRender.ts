/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {Position} from "../../Common/utils/game/Position";

export class GameObjectRender extends PIXI.Container {
    protected sprite: PIXI.Sprite;
    protected objectReference: GameObject;

    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;

        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectReference.SpriteName]);
        this.addChild(this.sprite);
        this.sprite.anchor.set(0.5, 0.5);
    }

    public update() {
       if(!this.sprite) {
           return;
       }
       let position: Position = this.objectReference.Position;
       this.x = position.X;
       this.y = position.Y;

        if(this.sprite.texture != PIXI.utils.TextureCache[this.objectReference.SpriteName]) {
           this.sprite.texture = PIXI.utils.TextureCache[this.objectReference.SpriteName];
       }

    }

    public destroy() {
        this.sprite.destroy()
    }
}
