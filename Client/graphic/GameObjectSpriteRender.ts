/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {Transform} from "../../Common/utils/physics/Transform";
import {GameObjectRender} from "../../Client/graphic/GameObjectRender";

export class GameObjectSpriteRender extends GameObjectRender {
    protected sprite: PIXI.Sprite;
    protected objectReference: GameObject;


    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;

        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectReference.SpriteName]);
        this.addChild(this.sprite);

        let transform: Transform = this.objectReference.Transform;
        this.sprite.width = transform.Width;
        this.sprite.height = transform.Height;

        this.sprite.anchor.set(0.5, 0.5);
    }

    public update() {
        super.update();

        if(this.sprite.texture != PIXI.utils.TextureCache[this.objectReference.SpriteName]) {
            this.sprite.texture = PIXI.utils.TextureCache[this.objectReference.SpriteName];
        }


    }

    public destroy() {
        this.destroy();
    }
}
