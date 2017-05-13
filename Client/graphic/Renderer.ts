/// <reference path="../libs/@types/phaser.d.ts" />

import {GameObject} from "../../Common/utils/GameObject";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";

export class Renderer {
    static phaserGame: Phaser.Game;

    private renderObjectMap: Map<GameObject, GameObjectRender>;

    constructor(afterCreateCallback: Function) {
        Renderer.phaserGame = new Phaser.Game(1024, 576, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.renderObjectMap = new Map<GameObject, GameObjectRender>();
    }

    private preload() {
        Renderer.phaserGame.load.image('bunny', 'resources/images/bunny.png');
        Renderer.phaserGame.load.image('dyzma', 'resources/images/dyzma.jpg');

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

    public addGameObject(gameObject: GameObject, type: string) {
        let gameObjectRender: GameObjectRender;

        if(type == "P") {
            gameObjectRender = new PlayerRender();
        }

        gameObjectRender.setObject(gameObject);
        this.renderObjectMap.set(gameObject, gameObjectRender);
    }

    public removeGameObject(gameObject: GameObject) {
        this.renderObjectMap.get(gameObject).hide();
        this.renderObjectMap.delete(gameObject);
    }

    get PhaserInput(): Phaser.Input {
        return Renderer.phaserGame.input;
    }
}