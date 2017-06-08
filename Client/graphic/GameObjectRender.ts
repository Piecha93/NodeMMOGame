/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {Position} from "../../Common/utils/game/Position";
import {Renderer} from "./Renderer";

export class GameObjectRender {
    protected sprite: PIXI.Sprite;
    protected objectReference: GameObject;

    constructor() {
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;

        let position: Position = this.objectReference.Position;
        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectReference.SpriteName]);
        Renderer.rootContainer.addChild(this.sprite);
        //this.sprite = Renderer.renderer.add.sprite(position.X, position.Y, this.objectReference.SpriteName);
        this.sprite.anchor.set(0.5, 0.5);
    }

    public update() {
       if(!this.sprite) {
           return;
       }
       let position: Position = this.objectReference.Position;
       this.sprite.x = position.X;
       this.sprite.y = position.Y;

       // if(this.sprite.texture.baseTexture.source.tagName != this.objectReference.SpriteName) {
       //     this.sprite.setTexture(PIXI.utils.TextureCache(this.objectReference.SpriteName))
       // }

    }

    public destroy() {
        Renderer.rootContainer.removeChild(this.sprite);
    }
}
