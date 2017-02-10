/// <reference path="../libs/@types/phaser.d.ts" />

import {GameObject} from "../../Common/utils/GameObject";
import {GameObjectRender} from "./GameObjectRender";

export class Renderer {
    private phaserGame: Phaser.Game;

    private objectList: Array<GameObjectRender>;

    constructor(afterCreateCallback: Function) {
        this.phaserGame = new Phaser.Game(800, 600, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.objectList = new Array<GameObjectRender>();
    }

    private preload() {
        this.phaserGame.load.image('bunny', 'resources/images/bunny.png');

        //this.phaserGame.load.onLoadComplete.addOnce(() => { console.log("ASSETS LOAD COMPLETE"); });
    }

    private create(afterCreateCallback: Function) {
        //console.log("PHASER CREATE");
        afterCreateCallback();
    }

    public update() {
        for(let gameObjectRender of this.objectList) {
            gameObjectRender.render();
        }
    }

    public addGameObject(gameObject: GameObject) {
        let gameObjectRender: GameObjectRender = new GameObjectRender(this.phaserGame);
        gameObjectRender.GameObject = gameObject;
        this.objectList.push(gameObjectRender);
    }

    get PhaserInput(): Phaser.Input {
        return this.phaserGame.input;
    }
}