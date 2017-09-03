import {GameObject} from "./GameObject";

export abstract class GameObjectsHolder {
    protected gameObjectsMapById: Map<string, GameObject>;

    constructor() {
        this.gameObjectsMapById = new Map<string, GameObject>();
    }

    public addGameObject(gameObject: GameObject) {
        gameObject.addDestroyListener(this.onDestroy.bind(this));
        this.gameObjectsMapById.set(gameObject.ID, gameObject);
    }

    public removeGameObject(gameObject: GameObject) {
        this.gameObjectsMapById.delete(gameObject.ID);
    }

    public removeGameObjectById(id: string) {
        if(this.gameObjectsMapById.has(id)) {
            this.removeGameObject(this.gameObjectsMapById.get(id));
        }
    }

    onDestroy(id: string) {
        this.removeGameObjectById(id);
    }

    public getGameObject(id: string): GameObject {
        return this.gameObjectsMapById.get(id);
    }

    public has(id: string): boolean {
        return this.gameObjectsMapById.has(id);
    }
}