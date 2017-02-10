/// <reference path="../libs/@types/phaser.d.ts" />

import {GameObject} from "../utils/GameObject";
import {Position} from "../utils/Position";

export class GameObjectRender {
    private phaserGame: Phaser.Game;
    private sprite: Phaser.Sprite;
    private objectReference: GameObject;


    constructor(phaserGame: Phaser.Game) {
        this.phaserGame = phaserGame;
    }

    set GameObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;

        let position: Position = this.objectReference.Position;
        this.sprite = this.phaserGame.add.sprite(position.X, position.Y, 'bunny');
        this.sprite.anchor.setTo(0.5, 0.5);
    }

    public render() {
       if(this.sprite) {
           let position: Position = this.objectReference.Position;
           this.sprite.x = position.X;
           this.sprite.y = position.Y;
       }
    }
}
