/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {Transform} from "../../Common/utils/game/Transform";

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
        // this.sprite.anchor.set(-0.5, -0.5);
    }

    public update() {
       if(!this.sprite) {
           return;
       }
       let transform: Transform = this.objectReference.Transform;
       this.x = transform.X;
       this.y = transform.Y;

       this.sprite.width = transform.Width;
       this.sprite.height = transform.Height;

       if(this.sprite.texture != PIXI.utils.TextureCache[this.objectReference.SpriteName]) {
           this.sprite.texture = PIXI.utils.TextureCache[this.objectReference.SpriteName];
       }

       this.sprite.rotation = this.objectReference.Transform.Rotation;
    }

    public destroy() {
        this.sprite.destroy();
    }
}
