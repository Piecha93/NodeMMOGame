/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../common/game_utils/game/objects/GameObject";
import {GameObjectsSubscriber} from "../../common/game_utils/factory/GameObjectsSubscriber";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";
import {Camera} from "./Camera";
import {GameObjectSpriteRender} from "./GameObjectSpriteRender";
import {TileMap} from "./TileMap";
import Sprite = PIXI.Sprite;
import {Types} from "../../common/game_utils/factory/GameObjectTypes";
import {GameObjectAnimationRender} from "./GameObjectAnimationRender";
import {HUD} from "./Hud";
import {ResourcesLoader, ResourceType} from "./ResourcesLoader";
import {Player} from "../../common/game_utils/game/objects/Player";
import {ChunksManager} from "../../common/game_utils/chunks/ChunksManager";


export class Renderer extends GameObjectsSubscriber {
    private renderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer;
    private rootContainer: PIXI.Container;
    private camera: Camera;
    private renderObjects: Map<GameObject, GameObjectRender>;
    private map: TileMap;
    private hud: HUD;
    private resourcesLoader: ResourcesLoader;
    private focusedObject: GameObject;
    private chunksManager: ChunksManager;

    static WIDTH: number = 1024;
    static HEIGHT: number = 576;

    constructor(afterCreateCallback: Function) {
        super();
        this.renderer = PIXI.autoDetectRenderer(Renderer.WIDTH, Renderer.HEIGHT, {
                  view:  document.getElementById("game-canvas") as HTMLCanvasElement,
                  antialias: false,
                  transparent: false,
                  resolution: 1,
                  clearBeforeRender: false
        });

        this.rootContainer = new PIXI.Container();

        this.camera = new Camera(new PIXI.Point(333,333));
        this.camera.addChild(this.rootContainer);
        this.focusedObject = null;
        this.chunksManager = null;

        this.renderObjects = new Map<GameObject, GameObjectRender>();

        this.resourcesLoader = ResourcesLoader.Instance;

        this.resourcesLoader.registerResource('none', 'resources/images/none.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('wall', 'resources/images/wall.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('bunny', 'resources/images/bunny.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('dyzma', 'resources/images/dyzma.jpg', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('kamis', 'resources/images/kamis.jpg', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('michau', 'resources/images/michau.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('panda', 'resources/images/panda.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('bullet', 'resources/images/bullet.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('fireball', 'resources/images/fireball.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('bluebolt', 'resources/images/bluebolt.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('hp_potion', 'resources/images/hp_potion.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('portal', 'resources/images/portal.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('white', 'resources/images/white.png', ResourceType.SPRITE);
        this.resourcesLoader.registerResource('flame', 'resources/animations/flame/flame.json', ResourceType.ANIMATION);
        this.resourcesLoader.registerResource('template_idle', 'resources/animations/actor_animations/template/idle.json', ResourceType.OCTAGONAL_ANIMATION);
        this.resourcesLoader.registerResource('template_run', 'resources/animations/actor_animations/template/run.json', ResourceType.OCTAGONAL_ANIMATION);
        this.resourcesLoader.registerResource('terrain', 'resources/maps/terrain.png', ResourceType.SPRITE);

        this.resourcesLoader.load(() => {
            this.map = new TileMap();
            this.rootContainer.addChild(this.map);

            afterCreateCallback();
        });
    }

    public createHUD() {
        this.hud = new HUD();
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
        this.renderObjects.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.update();
        });

        this.map.update();

        this.hideNotVisibleObjects();
        this.camera.update();

        this.renderer.render(this.camera);
        this.renderer.render(this.hud);
    }

    public onObjectCreate(gameObject: GameObject) {
        let gameObjectRender: GameObjectRender;

        let type: string = Types.IdToClassNames.get(gameObject.ID[0]);

        if(type == "Player" || type == "Enemy") {
            gameObjectRender = new PlayerRender();
        } else if(type == "FireBall") {
            gameObjectRender = new GameObjectAnimationRender();
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

    set FocusedObject(gameObject: GameObject) {
        this.camera.Follower = this.renderObjects.get(gameObject).position;
        this.map.FocusedObject = gameObject;
        this.focusedObject = gameObject;
    }

    set ChunksManager(chunksManager: ChunksManager) {
        this.map.ChunksManager = chunksManager;
        this.chunksManager = chunksManager;
    }

    get CameraDeviation(): [number, number] {
        return this.camera.MouseDeviation;
    }
}