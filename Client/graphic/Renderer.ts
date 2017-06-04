/// <reference path="../libs/@types/phaser.d.ts" />

import {GameObject} from "../../Common/utils/GameObject";
import {GameObjectsHolder} from "../../Common/utils/GameObjectsHolder";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";

export class Renderer extends GameObjectsHolder {
    static phaserGame: Phaser.Game;

    private renderObjects: Map<GameObject, GameObjectRender>;

    constructor(afterCreateCallback: Function) {
        super();
        Renderer.phaserGame = new Phaser.Game(1024, 576, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.renderObjects = new Map<GameObject, GameObjectRender>();
    }

    private preload() {
        Renderer.phaserGame.load.image('bunny', 'resources/images/bunny.png');
        Renderer.phaserGame.load.image('dyzma', 'resources/images/dyzma.jpg');
        Renderer.phaserGame.load.image('bullet', 'resources/images/bullet.png');

        //this.phaserGame.load.onLoadComplete.addOnce(() => { console.log("ASSETS LOAD COMPLETE"); });
    }

    private create(afterCreateCallback: Function) {
        //console.log("PHASER CREATE");
        afterCreateCallback();
    }

    public update(){
        this.renderObjects.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.render();
        });
    }

    addGameObject(gameObject: GameObject) {
        super.addGameObject(gameObject);

        console.log("chujdupoa");
        let gameObjectRender: GameObjectRender;

        let type: string = gameObject.ID[0];
        if(type == "P") {
            gameObjectRender = new PlayerRender();
        } else {
            gameObjectRender = new GameObjectRender();
        }

        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
    }

    public removeGameObject(gameObject: GameObject) {
        super.removeGameObject(gameObject);
        this.renderObjects.get(gameObject).destroy();
        this.renderObjects.delete(gameObject);
    }

    get PhaserInput(): Phaser.Input {
        return Renderer.phaserGame.input;
    }
}