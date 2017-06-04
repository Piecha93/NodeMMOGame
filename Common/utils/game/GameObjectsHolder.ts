import {GameObject} from "./GameObject";

export abstract class GameObjectsHolder {
    protected gameObjects: Map<string, GameObject> = new Map<string, GameObject>();

    onDestroy(id: string) {
        this.removeGameObjectById(id);
    }

    public addGameObject(gameObject: GameObject) {
        gameObject.addDestroyListener(this.onDestroy.bind(this));
        this.gameObjects.set(gameObject.ID, gameObject);
    }

    public removeGameObject(gameObject: GameObject) {
        this.gameObjects.delete(gameObject.ID);
    }

    public removeGameObjectById(id: string) {
        if(this.gameObjects.has(id)) {
            this.removeGameObject(this.gameObjects.get(id));
        }
    }

    public getGameObject(id: string): GameObject {
        return this.gameObjects.get(id);
    }

    public has(id: string): boolean {
        return this.gameObjects.has(id);
    }
}