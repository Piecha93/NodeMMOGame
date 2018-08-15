import {GameObject} from "../game/objects/GameObject";
import {GameObjectsFactory} from "./ObjectsFactory"
import {GameObjectsManager} from "./GameObjectsManager";

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
        return GameObjectsManager.gameObjectsMapById;
    }

    public getGameObject(id: string) {
        return GameObjectsManager.GetGameObjectById(id);
    }
}