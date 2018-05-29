import {GameObject} from "./GameObject";
import {GameObjectsFactory, GameObjectsContainer} from  "./ObjectsFactory"

export abstract class GameObjectsSubscriber {

    protected constructor() {
        GameObjectsFactory.CreateCallbacks.push(this.onObjectCreate.bind(this));
        GameObjectsFactory.DestroyCallbacks.push(this.onObjectDestroy.bind(this));
    }

    protected onObjectCreate(gameObject: GameObject) {

    }

    protected onObjectDestroy(gameObject: GameObject) {

    }

    get GameObjectsMapById() {
        return GameObjectsContainer.gameObjectsMapById;
    }

    public getGameObject(id: string) {
        return GameObjectsContainer.gameObjectsMapById.get(id);
    }
}