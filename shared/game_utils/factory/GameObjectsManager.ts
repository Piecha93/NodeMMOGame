import { GameObject } from "../game/objects/GameObject";

export interface GameObjectsSubscription {
    created?: (gameObject: GameObject) => void;
    destroyed?: (gameObject: GameObject) => void;
}

export interface GameObjectsErrorContext {
    event: "created" | "destroyed";
    gameObject: GameObject;
}

export type GameObjectsErrorSink = (error: unknown, context: GameObjectsErrorContext) => void;

export class GameObjectsManager {
    private readonly objectsById: Map<string, GameObject> = new Map<string, GameObject>();
    private readonly subscriptions: Set<GameObjectsSubscription> = new Set<GameObjectsSubscription>();
    private readonly objectSubscriptions: WeakMap<GameObject, Set<GameObjectsSubscription>> = new WeakMap<
        GameObject,
        Set<GameObjectsSubscription>
    >();
    private readonly errorSink: GameObjectsErrorSink;
    private isDisposed: boolean = false;

    constructor(errorSink: GameObjectsErrorSink = GameObjectsManager.defaultErrorSink) {
        this.errorSink = errorSink;
    }

    public get ObjectsById(): ReadonlyMap<string, GameObject> {
        return this.objectsById;
    }

    public get(id: string): GameObject | undefined {
        return this.objectsById.get(id);
    }

    public destroy(id: string): boolean {
        const gameObject = this.objectsById.get(id);
        if (!gameObject) {
            return false;
        }

        try {
            gameObject.destroy();
        } finally {
            this.removeIfSame(id, gameObject);
        }
        return true;
    }

    public register(gameObject: GameObject): GameObject {
        this.assertActive();

        if (!gameObject.ID) {
            throw new Error("Cannot register a game object without an id");
        }
        if (gameObject.IsDestroyed) {
            throw new Error(`Cannot register destroyed game object '${gameObject.ID}'`);
        }
        if (this.objectsById.has(gameObject.ID)) {
            throw new Error(`Duplicate game object id: ${gameObject.ID}`);
        }

        const registeredId = gameObject.ID;
        this.objectSubscriptions.set(gameObject, new Set<GameObjectsSubscription>());
        gameObject.addDestroyListener((destroyedObject: GameObject) => {
            this.removeIfSame(registeredId, destroyedObject);
            const errors = this.notifyDestroyed(destroyedObject);
            this.objectSubscriptions.delete(destroyedObject);
            if (errors.length > 0) {
                throw new AggregateError(errors, `Destroy subscribers failed for '${destroyedObject.ID}'`);
            }
        });
        this.objectsById.set(registeredId, gameObject);

        const createErrors = this.notifyCreated(gameObject);
        if (createErrors.length > 0) {
            const rollbackErrors: unknown[] = [];
            try {
                gameObject.destroy();
            } catch (error) {
                rollbackErrors.push(error);
            } finally {
                this.removeIfSame(registeredId, gameObject);
            }

            throw new AggregateError(
                [...createErrors, ...rollbackErrors],
                `Create subscribers failed for '${gameObject.ID}'`,
            );
        }

        return gameObject;
    }

    public subscribe(subscription: GameObjectsSubscription): () => void {
        this.assertActive();

        const storedSubscription: GameObjectsSubscription = {
            created: subscription.created,
            destroyed: subscription.destroyed,
        };
        this.subscriptions.add(storedSubscription);

        let isSubscribed = true;
        return () => {
            if (!isSubscribed) {
                return;
            }
            isSubscribed = false;
            this.subscriptions.delete(storedSubscription);
        };
    }

    public dispose(): void {
        if (this.isDisposed) {
            return;
        }
        this.isDisposed = true;

        const errors: unknown[] = [];
        for (const [registeredId, gameObject] of Array.from(this.objectsById.entries())) {
            try {
                gameObject.destroy();
            } catch (error) {
                errors.push(error);
            } finally {
                this.removeIfSame(registeredId, gameObject);
            }
        }

        this.objectsById.clear();
        this.subscriptions.clear();

        if (errors.length > 0) {
            throw new AggregateError(errors, "Failed to dispose all game objects");
        }
    }

    private notifyCreated(gameObject: GameObject): unknown[] {
        const errors: unknown[] = [];
        const objectSubscriptions = this.objectSubscriptions.get(gameObject);
        for (const subscription of Array.from(this.subscriptions)) {
            if (!this.subscriptions.has(subscription)) {
                continue;
            }

            objectSubscriptions?.add(subscription);
            if (subscription.created) {
                try {
                    subscription.created(gameObject);
                } catch (error) {
                    errors.push(error);
                    this.reportError(error, { event: "created", gameObject });
                }
            }

            if (gameObject.IsDestroyed) {
                break;
            }
        }
        return errors;
    }

    private notifyDestroyed(gameObject: GameObject): unknown[] {
        const errors: unknown[] = [];
        const objectSubscriptions = this.objectSubscriptions.get(gameObject) ?? new Set<GameObjectsSubscription>();

        for (const subscription of Array.from(objectSubscriptions)) {
            if (!this.subscriptions.has(subscription) || !subscription.destroyed) {
                continue;
            }

            try {
                subscription.destroyed(gameObject);
            } catch (error) {
                errors.push(error);
                this.reportError(error, { event: "destroyed", gameObject });
            }
        }
        return errors;
    }

    private removeIfSame(registeredId: string, gameObject: GameObject): void {
        if (this.objectsById.get(registeredId) === gameObject) {
            this.objectsById.delete(registeredId);
        }
    }

    private reportError(error: unknown, context: GameObjectsErrorContext): void {
        try {
            this.errorSink(error, context);
        } catch (_errorSinkError) {
            // Lifecycle cleanup must not depend on diagnostics succeeding.
        }
    }

    private assertActive(): void {
        if (this.isDisposed) {
            throw new Error("Game objects manager is disposed");
        }
    }

    private static defaultErrorSink(error: unknown, context: GameObjectsErrorContext): void {
        console.error(`Game object ${context.event} subscriber failed for '${context.gameObject.ID}'`, error);
    }
}
