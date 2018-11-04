/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {GameObjectRender} from "../graphic/GameObjectRender";

export class GameObjectSpriteRender extends GameObjectRender {
    protected sprite: PIXI.Sprite;

    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectRef = gameObjectReference;

        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectRef.SpriteName]);
        this.addChild(this.sprite);

        this.sprite.width = this.objectRef.Transform.ScaleX;
        this.sprite.height = this.objectRef.Transform.ScaleY;

        this.sprite.anchor.set(0.5, 0.5);
    }

    public update() {
        super.update();

        if(this.sprite.texture != PIXI.utils.TextureCache[this.objectRef.SpriteName]) {
            this.sprite.texture = PIXI.utils.TextureCache[this.objectRef.SpriteName];
        }

        this.sprite.width = this.objectRef.Transform.ScaleX;
        this.sprite.height = this.objectRef.Transform.ScaleY;
    }

    public destroy() {
        super.destroy();
    }
}
