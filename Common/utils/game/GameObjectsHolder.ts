import {GameObject} from "./GameObject";

export abstract class GameObjectsHolder {
    protected gameObjectsMapById;
    //protected gameObjectsArray: Array<GameObject> = new Array<GameObject>();

    constructor() {
        this.gameObjectsMapById = new Map<string, GameObject>();
    }

    onDestroy(id: string) {
        this.removeGameObjectById(id);
    }

    public addGameObject(gameObject: GameObject) {
        gameObject.addDestroyListener(this.onDestroy.bind(this));
        this.gameObjectsMapById.set(gameObject.ID, gameObject);
        //this.gameObjectsArray.push(gameObject);
    }

    public removeGameObject(gameObject: GameObject) {
        this.gameObjectsMapById.delete(gameObject.ID);

        // for (let idx; (idx = this.gameObjectsArray.indexOf(gameObject)) != -1;) {
        //     this.gameObjectsArray.splice(idx, 1);
        // }
    }

    public removeGameObjectById(id: string) {
        if(this.gameObjectsMapById.has(id)) {
            this.removeGameObject(this.gameObjectsMapById.get(id));
        }
    }

    public getGameObject(id: string): GameObject {
        return this.gameObjectsMapById.get(id);
    }

    public has(id: string): boolean {
        return this.gameObjectsMapById.has(id);
    }
}