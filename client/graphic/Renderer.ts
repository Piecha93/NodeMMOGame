import { autoDetectRenderer, Container, Point } from "pixi.js";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectsSubscriber } from "../../shared/game_utils/factory/GameObjectsSubscriber";
import { GameObjectsManager } from "../../shared/game_utils/factory/GameObjectsManager";
import { GameObjectRender } from "./GameObjectRender";
import { PlayerRender } from "./PlayerRender";
import { ProjectileRender } from "./ProjectileRender";
import { Camera } from "./Camera";
import { GameObjectSpriteRender } from "./GameObjectSpriteRender";
import { TileMap, TileMapConfig } from "./TileMap";
import { GameObjectAnimationRender } from "./GameObjectAnimationRender";
import { HUD } from "./Hud";
import { ResourcesLoader, ResourceType } from "./ResourcesLoader";
import { Chunk } from "../../shared/chunks/Chunk";
import { Resource } from "./ResourcesLoader";
import { RESOURCE_MANIFEST } from "./ResourceManifest";
import { presentationKind } from "./Presentation";
import { ExpeditionMarkers } from "./ExpeditionMarkers";
import { ExpeditionState } from "../../shared/gameplay/Expedition";

type PixiRenderer = Awaited<ReturnType<typeof autoDetectRenderer>>;
type CameraObject = Pick<Container, "x" | "y" | "width" | "height">;

export class Renderer extends GameObjectsSubscriber {
    private renderer: PixiRenderer;
    private stage: Container;
    private rootContainer: Container;
    private camera: Camera;
    private renderObjects: Map<GameObject, GameObjectRender>;
    private readonly renderObjectsById = new Map<string, GameObjectRender>();
    private map: TileMap | null = null;
    private hud: HUD | null = null;
    private expeditionMarkers: ExpeditionMarkers | null = null;
    private resourcesLoader: ResourcesLoader;
    private disposed: boolean = false;
    private visibleObjectCount = 0;

    static WIDTH: number = 1024;
    static HEIGHT: number = 576;

    private constructor(renderer: PixiRenderer, objectsManager: GameObjectsManager) {
        super(objectsManager, false);
        this.renderer = renderer;
        this.stage = new Container();
        this.rootContainer = new Container();

        this.camera = new Camera(new Point(333, 333));
        this.camera.addChild(this.rootContainer);
        this.stage.addChild(this.camera);

        this.renderObjects = new Map<GameObject, GameObjectRender>();

        this.resourcesLoader = ResourcesLoader.Instance;
    }

    public static async create(objectsManager: GameObjectsManager, config?: TileMapConfig): Promise<Renderer> {
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
            resolution: 1,
        });

        let renderer: Renderer | undefined;
        try {
            renderer = new Renderer(pixiRenderer, objectsManager);
            await renderer.initialize(config);
            renderer.subscribeToManager();
            return renderer;
        } catch (error) {
            if (renderer) {
                renderer.dispose();
            } else {
                pixiRenderer.destroy();
            }
            throw error;
        }
    }

    private async initialize(config?: TileMapConfig): Promise<void> {
        RESOURCE_MANIFEST.forEach(({ name, path, type }) => {
            this.resourcesLoader.registerResource(name, path, type);
        });
        await this.resourcesLoader.load();

        this.map = new TileMap(config);
        this.rootContainer.addChild(this.map);
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;

        super.dispose();
        this.renderObjects.clear();
        this.renderObjectsById.clear();
        this.stage.destroy({ children: true });
        this.renderer.destroy();
    }

    public createHUD(): void {
        if (this.disposed || this.hud) return;
        this.hud = new HUD();
        this.stage.addChild(this.hud);
    }

    public setExpeditionState(state: ExpeditionState): void {
        if (this.disposed) return;
        if (!this.expeditionMarkers) {
            this.expeditionMarkers = new ExpeditionMarkers();
            this.rootContainer.addChildAt(this.expeditionMarkers, this.map ? 1 : 0);
        }
        this.expeditionMarkers.setState(state);
    }

    private hideNotVisibleObjects() {
        this.visibleObjectCount = 0;
        this.renderObjects.forEach((obj: GameObjectRender) => {
            obj.visible = obj.PresentationVisible && this.isInCameraView(obj);
            if (obj.visible) this.visibleObjectCount++;
        });

        this.map?.children.forEach((obj) => {
            obj.visible = this.isInCameraView(obj);
        });
    }

    private isInCameraView(object: CameraObject): boolean {
        let buffor = 100;

        let cameraX = this.camera.pivot.x - Renderer.WIDTH / 2 - buffor;
        let cameraY = this.camera.pivot.y - Renderer.HEIGHT / 2 - buffor;

        return (
            object.x < cameraX + Renderer.WIDTH + 2 * buffor &&
            object.y < cameraY + Renderer.HEIGHT + 2 * buffor &&
            cameraX < object.x + object.width &&
            cameraY < object.y + object.height
        );
    }

    public update(deltaMs: number = 1000 / 60) {
        if (this.disposed) return;
        this.renderObjects.forEach((gameObjectRender: GameObjectRender) => {
            gameObjectRender.update(deltaMs);
        });

        this.map?.update();

        this.camera.update(deltaMs);
        this.hideNotVisibleObjects();

        this.renderer.render(this.stage);
    }

    public onObjectCreate(gameObject: GameObject) {
        if (this.disposed || gameObject.IsDestroyed || this.renderObjects.has(gameObject)) {
            return;
        }
        let gameObjectRender: GameObjectRender;

        const resource: Resource = this.resourcesLoader.getResource(gameObject.SpriteName);
        const kind = presentationKind(gameObject, resource.type);
        if (kind === "actor") {
            gameObjectRender = new PlayerRender();
        } else if (kind === "projectile") {
            gameObjectRender = new ProjectileRender();
        } else if (kind === "animation") {
            gameObjectRender = new GameObjectAnimationRender();
        } else {
            gameObjectRender = new GameObjectSpriteRender();
        }

        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
        this.renderObjectsById.set(gameObject.ID, gameObjectRender);
        this.rootContainer.addChild(gameObjectRender);
    }

    public onObjectDestroy(gameObject: GameObject) {
        const renderObject = this.renderObjects.get(gameObject);
        if (renderObject) {
            renderObject.destroy();
            this.renderObjects.delete(gameObject);
            this.renderObjectsById.delete(gameObject.ID);
        }
    }

    set FocusedObject(gameObject: GameObject) {
        const renderObject = this.renderObjects.get(gameObject);
        if (!renderObject) {
            throw new Error(`Cannot focus an object without a renderer: ${gameObject.ID}`);
        }

        this.camera.Follower = renderObject.position;
        if (this.map) this.map.FocusedObject = gameObject;
    }

    setCurrentChunk(chunk: Chunk) {
        if (this.map) this.map.CurrentChunk = chunk;
    }

    public setPresentationPosition(id: string, position: [number, number] | undefined): void {
        const rendered = this.renderObjectsById.get(id);
        if (rendered) rendered.presentationPosition = position;
    }

    get CameraDeviation(): [number, number] {
        return this.camera.MouseDeviation;
    }

    get VisibleObjectCount(): number {
        return this.visibleObjectCount;
    }

    public updatePointer(event: Pick<MouseEvent, "clientX" | "clientY">): void {
        this.camera.updatePointer(event);
    }

    get PointerWorldPosition(): [number, number] {
        return this.camera.PointerWorldPosition;
    }
}
