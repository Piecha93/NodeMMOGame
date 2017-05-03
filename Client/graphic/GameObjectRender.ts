/// <reference path="../libs/@types/phaser.d.ts" />

import {GameObject} from "../../Common/utils/GameObject";
import {Position} from "../../Common/utils/Position";
import {Renderer} from "./Renderer";

export class GameObjectRender {
    protected sprite: Phaser.Sprite;
    protected objectReference: GameObject;

    constructor() {
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;

        let position: Position = this.objectReference.Position;
        this.sprite = Renderer.phaserGame.add.sprite(position.X, position.Y, 'bunny');
        this.sprite.anchor.setTo(0.5, 0.5);
    }

    public render() {
       if(this.sprite) {
           let position: Position = this.objectReference.Position;
           this.sprite.x = position.X;
           this.sprite.y = position.Y;
       }
    }

    public hide() {
        this.sprite.destroy();
    }
}
