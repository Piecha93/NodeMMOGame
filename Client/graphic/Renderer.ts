/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {GameObjectsHolder} from "../../Common/utils/game/GameObjectsHolder";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";
import {BulletRender} from "./BulletRender";


export class Renderer extends GameObjectsHolder {
    static renderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer;
    static rootContainer: PIXI.Container;

    private renderObjects: Map<GameObject, GameObjectRender>;

    constructor(afterCreateCallback: Function) {
        super();
        Renderer.renderer = PIXI.autoDetectRenderer(1024, 576, {view:  document.getElementById("game-canvas") as HTMLCanvasElement});
        Renderer.rootContainer = new PIXI.Container();

        Renderer.renderer.render(Renderer.rootContainer);

        this.renderObjects = new Map<GameObject, GameObjectRender>();

        PIXI.loader
            .add('bunny', 'resources/images/bunny.png')
            .add('dyzma', 'resources/images/dyzma.jpg')
            .add('bullet', 'resources/images/bullet.png')
            .add('fireball', 'resources/images/fireball.png')
            .add('bluebolt', 'resources/images/bluebolt.png')
            .load(afterCreateCallback);
    }

    public update(){
        this.renderObjects.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.update();
        });

        Renderer.renderer.render(Renderer.rootContainer);
    }

    addGameObject(gameObject: GameObject) {
        super.addGameObject(gameObject);

        let gameObjectRender: GameObjectRender;

        let type: string = gameObject.ID[0];
        if(type == "P") {
            gameObjectRender = new PlayerRender();
        } else if(type == "B") {
            gameObjectRender = new BulletRender();
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
}