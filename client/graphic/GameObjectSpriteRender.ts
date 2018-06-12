/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../common/utils/game/GameObject";
import {Transform} from "../../common/utils/physics/Transform";
import {GameObjectRender} from "../graphic/GameObjectRender";

export class GameObjectSpriteRender extends GameObjectRender {
    protected sprite: PIXI.Sprite;
    protected objectRef: GameObject;


    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectRef = gameObjectReference;

        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectRef.SpriteName]);
        this.addChild(this.sprite);

        this.sprite.width = this.objectRef.Transform.Width;
        this.sprite.height = this.objectRef.Transform.Height;

        this.sprite.anchor.set(0.5, 0.5);
    }

    public update() {
        super.update();

        if(this.sprite.texture != PIXI.utils.TextureCache[this.objectRef.SpriteName]) {
            this.sprite.texture = PIXI.utils.TextureCache[this.objectRef.SpriteName];
        }

        this.sprite.width = this.objectRef.Transform.Width;
        this.sprite.height = this.objectRef.Transform.Height;
    }

    public destroy() {
        super.destroy();
    }
}
