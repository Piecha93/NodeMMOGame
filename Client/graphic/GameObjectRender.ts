/// <reference path="../libs/@types/phaser.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {Position} from "../../Common/utils/game/Position";
import {Renderer} from "./Renderer";

export class GameObjectRender {
    protected sprite: Phaser.Sprite;
    protected objectReference: GameObject;

    constructor() {
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;

        let position: Position = this.objectReference.Position;
        this.sprite = Renderer.phaserGame.add.sprite(position.X, position.Y, this.objectReference.SpriteName);
        this.sprite.anchor.setTo(0.5, 0.5);
    }

    public render() {
       if(!this.sprite) {
           return;
       }
       let position: Position = this.objectReference.Position;
       this.sprite.x = position.X;
       this.sprite.y = position.Y;

       if(this.sprite.texture.baseTexture.source.name != this.objectReference.SpriteName) {
           this.sprite.loadTexture(this.objectReference.SpriteName);
       }

    }

    public destroy() {
        this.sprite.destroy();
    }
}
