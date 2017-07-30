/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {GameObjectsHolder} from "../../Common/utils/game/GameObjectsHolder";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";
import {BulletRender} from "./BulletRender";
import {RectRenderer} from "./RectRenderer";
import {Cell} from "../../Common/utils/physics/SpacialGrid";
import {Camera} from "../../Client/graphic/Camera";
import {GameObjectSpriteRender} from "../../Client/graphic/GameObjectSpriteRender";


export class Renderer extends GameObjectsHolder {
    private renderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer;
    private rootContainer: PIXI.Container;
    private camera: Camera;
    private renderObjects: Map<GameObject, GameObjectRender>;
    private renderCells: Map<Cell, RectRenderer>;

    static HEIGHT: number = 576;
    static WIDTH: number = 1024;

    constructor(afterCreateCallback: Function) {
        super();
        this.renderer =
            PIXI.autoDetectRenderer(Renderer.WIDTH, Renderer.HEIGHT, {
                  view:  document.getElementById("game-canvas") as HTMLCanvasElement,
                  antialias: false,
                  transparent: false,
                  resolution: 1});
        this.rootContainer = new PIXI.Container();

        this.camera = new Camera(new PIXI.Point(333,333));
        this.camera.addChild(this.rootContainer);

        this.renderObjects = new Map<GameObject, GameObjectRender>();
        this.renderCells = new Map<Cell, RectRenderer>();

        PIXI.loader
            .add('bunny', 'resources/images/bunny.png')
            .add('dyzma', 'resources/images/dyzma.jpg')
            .add('kamis', 'resources/images/kamis.jpg')
            .add('panda', 'resources/images/panda.png')
            .add('bullet', 'resources/images/bullet.png')
            .add('fireball', 'resources/images/fireball.png')
            .add('bluebolt', 'resources/images/bluebolt.png')
            .add('flame', 'resources/animations/flame/flame.json')
            .load(afterCreateCallback);
    }

    public update(){
        this.renderObjects.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.update();
        });

        this.renderCells.forEach((boxRenderer: RectRenderer) => {
            boxRenderer.update();
        });
        this.camera.update();
        this.renderer.render(this.camera);
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
            gameObjectRender = new GameObjectSpriteRender();
        }

        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
        this.rootContainer.addChild(gameObjectRender);
    }

    set CameraFollower(gameObject: GameObject) {
        this.camera.Follower = this.renderObjects.get(gameObject).position;
    }

    public addCell(cell: Cell) {
        let boxRenderer: RectRenderer = new RectRenderer();
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