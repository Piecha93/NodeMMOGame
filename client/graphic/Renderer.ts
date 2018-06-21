/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../common/utils/game/GameObject";
import {GameObjectsSubscriber} from "../../common/utils/game/GameObjectsSubscriber";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";
import {BulletRender} from "./BulletRender";
import {Camera} from "./Camera";
import {GameObjectSpriteRender} from "./GameObjectSpriteRender";
import {TileMap} from "./TileMap";
import Container = PIXI.Container;
import DisplayObject = PIXI.DisplayObject;
import Sprite = PIXI.Sprite;
import {Types} from "../../common/utils/game/GameObjectTypes";


export class Renderer extends GameObjectsSubscriber {
    private renderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer;
    private rootContainer: PIXI.Container;
    private camera: Camera;
    private renderObjects: Map<GameObject, GameObjectRender>;
    private map: TileMap;

    static WIDTH: number = 1024;
    static HEIGHT: number = 576;

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

        PIXI.loader
            .add('none', 'resources/images/none.png')
            .add('wall', 'resources/images/wall.png')
            .add('bunny', 'resources/images/bunny.png')
            .add('dyzma', 'resources/images/dyzma.jpg')
            .add('kamis', 'resources/images/kamis.jpg')
            .add('michau', 'resources/images/michau.png')
            .add('panda', 'resources/images/panda.png')
            .add('bullet', 'resources/images/bullet.png')
            .add('fireball', 'resources/images/fireball.png')
            .add('bluebolt', 'resources/images/bluebolt.png')
            .add('hp_potion', 'resources/images/hp_potion.png')
            .add('flame', 'resources/animations/flame/flame.json')
            .add('terrain', 'resources/maps/terrain.png')
            .load(afterCreateCallback);
    }

    private hideNotVisibleObjects() {
        this.renderObjects.forEach((obj: GameObjectRender) => {
            obj.visible = this.isInCameraView(obj);
        });

        this.map.children.forEach((obj: Sprite) => {
            obj.visible = this.isInCameraView(obj);
        });

    }

    private isInCameraView(object: any): boolean {
        let buffor = 100;

        let cameraX = this.camera.pivot.x - Renderer.WIDTH / 2 - buffor;
        let cameraY = this.camera.pivot.y - Renderer.HEIGHT / 2 - buffor;

        return (object.x < cameraX + Renderer.WIDTH + 2*buffor) &&
            (object.y < cameraY + Renderer.HEIGHT + 2*buffor) &&
            (cameraX < object.x + object.width) &&
            (cameraY < object.y + object.height);
    }

    public update(){
        this.hideNotVisibleObjects();

        this.renderObjects.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.update();
        });

        this.camera.update();
        this.renderer.render(this.camera);
    }

    public setMap(map?: number[][]) {
        this.map = new TileMap();

        this.rootContainer.addChild(this.map);
    }

    public onObjectCreate(gameObject: GameObject) {
        let gameObjectRender: GameObjectRender;

        let type: string = Types.IdToClassNames.get(gameObject.ID[0]);

        if(type == "Player" || type == "Enemy") {
            gameObjectRender = new PlayerRender();
        } else if(type == "Bullet") {
            gameObjectRender = new BulletRender();
        } else {
            gameObjectRender = new GameObjectSpriteRender();
        }

        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
        this.rootContainer.addChild(gameObjectRender);
    }

    public onObjectDestroy(gameObject: GameObject) {
        this.renderObjects.get(gameObject).destroy();
        this.renderObjects.delete(gameObject);
    }

    set CameraFollower(gameObject: GameObject) {
        this.camera.Follower = this.renderObjects.get(gameObject).position;
    }

    get CameraDeviation(): [number, number] {
        return this.camera.MouseDeviation;
    }
}