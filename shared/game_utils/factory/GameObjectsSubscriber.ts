import { GameObject } from "../game/objects/GameObject";
import { GameObjectsManager } from "./GameObjectsManager";

export abstract class GameObjectsSubscriber {
    private readonly manager: GameObjectsManager;
    private unsubscribeFromManager: (() => void) | null = null;

    protected constructor(manager: GameObjectsManager, subscribeImmediately: boolean = true) {
        this.manager = manager;
        if (subscribeImmediately) {
            this.subscribeToManager();
        }
    }

    protected subscribeToManager(): void {
        if (this.unsubscribeFromManager) {
            return;
        }
        this.unsubscribeFromManager = this.manager.subscribe({
            created: (gameObject: GameObject) => this.onObjectCreate(gameObject),
            destroyed: (gameObject: GameObject) => this.onObjectDestroy(gameObject),
        });
    }

    protected onObjectCreate(_gameObject: GameObject): void {}

    protected onObjectDestroy(_gameObject: GameObject): void {}

    public dispose(): void {
        this.unsubscribeFromManager?.();
        this.unsubscribeFromManager = null;
    }

    protected get GameObjectsMapById(): ReadonlyMap<string, GameObject> {
        return this.manager.ObjectsById;
    }

    protected get ObjectsManager(): GameObjectsManager {
        return this.manager;
    }

    public getGameObject(id: string): GameObject | undefined {
        return this.manager.get(id);
    }
}
