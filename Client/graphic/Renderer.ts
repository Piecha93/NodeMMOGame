/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {GameObjectsHolder} from "../../Common/utils/game/GameObjectsHolder";
import {Transform} from "../../Common/utils/game/Transform";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";
import {BulletRender} from "./BulletRender";
import {BoxRenderer} from "./BoxRenderer";
import {Cell} from "../../Common/utils/physics/SpacialGrid";


export class Renderer extends GameObjectsHolder {
    private renderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer;
    private rootContainer: PIXI.Container;
    private renderObjects: Map<GameObject, GameObjectRender>;
    private renderCells: Map<Cell, BoxRenderer>;

    constructor(afterCreateCallback: Function) {
        super();
        this.renderer =
            PIXI.autoDetectRenderer(1024, 576, {
                  view:  document.getElementById("game-canvas") as HTMLCanvasElement,
                  antialias: false,
                  transparent: false,
                  resolution: 1});
        this.rootContainer = new PIXI.Container();

        this.renderer.render(this.rootContainer);

        this.renderObjects = new Map<GameObject, GameObjectRender>();
        this.renderCells = new Map<Cell, BoxRenderer>();

        PIXI.loader
            .add('bunny', 'resources/images/bunny.png')
            .add('dyzma', 'resources/images/dyzma.jpg')
            .add('panda', 'resources/images/panda.png')
            .add('bullet', 'resources/images/bullet.png')
            .add('fireball', 'resources/images/fireball.png')
            .add('bluebolt', 'resources/images/bluebolt.png')
            .load(afterCreateCallback);
    }

    public update(){
        this.renderObjects.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.update();
        });

        this.renderCells.forEach((boxRenderer: BoxRenderer) => {
            boxRenderer.update();
        });

        this.renderer.render(this.rootContainer);
    }

    public addGameObject(gameObject: GameObject) {
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
        this.rootContainer.addChild(gameObjectRender);
    }

    public addCell(cell: Cell) {
        let boxRenderer: BoxRenderer = new BoxRenderer();
        boxRenderer.setObject(cell);
        this.renderCells.set(cell, boxRenderer);
        this.rootContainer.addChild(boxRenderer);
    }

    public removeGameObject(gameObject: GameObject) {
        super.removeGameObject(gameObject);
        this.renderObjects.get(gameObject).destroy();
        this.renderObjects.delete(gameObject);
    }
}