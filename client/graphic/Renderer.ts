import {autoDetectRenderer, Container, Point} from "pixi.js";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {GameObjectsSubscriber} from "../../shared/game_utils/factory/GameObjectsSubscriber";
import {GameObjectsManager} from "../../shared/game_utils/factory/GameObjectsManager";
import {GameObjectRender} from "./GameObjectRender";
import {PlayerRender} from "./PlayerRender";
import {Camera} from "./Camera";
import {GameObjectSpriteRender} from "./GameObjectSpriteRender";
import {TileMap} from "./TileMap";
import {Prefabs} from "../../shared/game_utils/factory/GameObjectPrefabs";
import {GameObjectAnimationRender} from "./GameObjectAnimationRender";
import {HUD} from "./Hud";
import {ResourcesLoader, ResourceType} from "./ResourcesLoader";
import {Chunk} from "../../shared/chunks/Chunk";
import {Resource} from "./ResourcesLoader";
import {RESOURCE_MANIFEST} from "./ResourceManifest";

type PixiRenderer = Awaited<ReturnType<typeof autoDetectRenderer>>;
type CameraObject = Pick<Container, "x" | "y" | "width" | "height">;

export class Renderer extends GameObjectsSubscriber {
    private renderer: PixiRenderer;
    private stage: Container;
    private rootContainer: Container;
    private camera: Camera;
    private renderObjects: Map<GameObject, GameObjectRender>;
    private map: TileMap;
    private hud: HUD;
    private resourcesLoader: ResourcesLoader;
    private disposed: boolean = false;

    static WIDTH: number = 1024;
    static HEIGHT: number = 576;

    private constructor(renderer: PixiRenderer, objectsManager: GameObjectsManager) {
        super(objectsManager, false);
        this.renderer = renderer;
        this.stage = new Container();
        this.rootContainer = new Container();

        this.camera = new Camera(new Point(333,333));
        this.camera.addChild(this.rootContainer);
        this.stage.addChild(this.camera);

        this.renderObjects = new Map<GameObject, GameObjectRender>();

        this.resourcesLoader = ResourcesLoader.Instance;
    }

    public static async create(objectsManager: GameObjectsManager): Promise<Renderer> {
        const canvas = document.getElementById("game-canvas");
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error("Cannot initialize PixiJS: #game-canvas is missing");
        }

        const pixiRenderer = await autoDetectRenderer({
            preference: "webgl",
            width: Renderer.WIDTH,
            height: Renderer.HEIGHT,
            canvas,
            antialias: false,
            backgroundAlpha: 1,
            resolution: 1
        });

        let renderer: Renderer | undefined;
        try {
            renderer = new Renderer(pixiRenderer, objectsManager);
            await renderer.initialize();
            renderer.subscribeToManager();
            return renderer;
        } catch(error) {
            if(renderer) {
                renderer.dispose();
            } else {
                pixiRenderer.destroy();
            }
            throw error;
        }
    }

    private async initialize(): Promise<void> {
        RESOURCE_MANIFEST.forEach(({name, path, type}) => {
            this.resourcesLoader.registerResource(name, path, type);
        });
        await this.resourcesLoader.load();

        this.map = new TileMap();
        this.rootContainer.addChild(this.map);
    }

    public dispose(): void {
        if(this.disposed) {
            return;
        }
        this.disposed = true;

        super.dispose();
        this.renderObjects.clear();
        this.stage.destroy({children: true});
        this.renderer.destroy();
    }

    public createHUD(): void {
        this.hud = new HUD();
        this.stage.addChild(this.hud);
    }

    private hideNotVisibleObjects() {
        this.renderObjects.forEach((obj: GameObjectRender) => {
            obj.visible = this.isInCameraView(obj);
        });

        this.map.children.forEach((obj) => {
            obj.visible = this.isInCameraView(obj);
        });
    }

    private isInCameraView(object: CameraObject): boolean {
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

        this.renderer.render(this.stage);
    }

    public onObjectCreate(gameObject: GameObject) {
        if(gameObject.IsDestroyed) {
            return;
        }
        let gameObjectRender: GameObjectRender;

        let type: string = Prefabs.IdToPrefabNames.get(gameObject.ID[0]);

        const resource: Resource = this.resourcesLoader.getResource(gameObject.SpriteName);
        if(type == "DefaultPlayer" || type == "Michau") {
            gameObjectRender = new PlayerRender();
        } else if(resource.type == ResourceType.ANIMATION || resource.type == ResourceType.OCTAGONAL_ANIMATION) {
            gameObjectRender = new GameObjectAnimationRender();
        } else {
            gameObjectRender = new GameObjectSpriteRender();
        }

        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
        this.rootContainer.addChild(gameObjectRender);
    }

    public onObjectDestroy(gameObject: GameObject) {
        const renderObject = this.renderObjects.get(gameObject);
        if(renderObject) {
            renderObject.destroy();
            this.renderObjects.delete(gameObject);
        }
    }

    set FocusedObject(gameObject: GameObject) {
        const renderObject = this.renderObjects.get(gameObject);
        if (!renderObject) {
            throw new Error(`Cannot focus an object without a renderer: ${gameObject.ID}`);
        }

        this.camera.Follower = renderObject.position;
        this.map.FocusedObject = gameObject;
    }

    setCurrentChunk(chunk: Chunk) {
        this.map.CurrentChunk = chunk;
    }

    get CameraDeviation(): [number, number] {
        return this.camera.MouseDeviation;
    }
}
