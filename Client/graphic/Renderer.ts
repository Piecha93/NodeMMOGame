/// <reference path="../libs/@types/phaser.d.ts" />

import {GameObject} from "../../Common/utils/GameObject";
import {GameObjectRender} from "./GameObjectRender";

export class Renderer {
    private phaserGame: Phaser.Game;

    private renderObjectMap: Map<GameObject, GameObjectRender>;

    constructor(afterCreateCallback: Function) {
        this.phaserGame = new Phaser.Game(1280, 720, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.renderObjectMap = new Map<GameObject, GameObjectRender>();
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
        this.renderObjectMap.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.render();
        });
    }

    public addGameObject(gameObject: GameObject) {
        let gameObjectRender: GameObjectRender = new GameObjectRender(this.phaserGame);
        gameObjectRender.GameObject = gameObject;
        this.renderObjectMap.set(gameObject, gameObjectRender);
    }

    public removeGameObject(gameObject: GameObject) {
        this.renderObjectMap.get(gameObject).hide();
        this.renderObjectMap.delete(gameObject);
    }

    get PhaserInput(): Phaser.Input {
        return this.phaserGame.input;
    }
}