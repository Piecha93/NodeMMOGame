import {GameObject} from "../game/objects/GameObject";

export class GameObjectsManager {
    public static readonly gameObjectsMapById: Map<string, GameObject> = new Map<string, GameObject>();

    public static GetGameObjectById(id: string): GameObject {
        return GameObjectsManager.gameObjectsMapById.get(id);
    }

    public static DestroyGameObjectById(id: string): boolean {
        let gameObject: GameObject = GameObjectsManager.gameObjectsMapById.get(id);
        if(gameObject) {
            gameObject.destroy();
            return true;
        }
        return false;
    }
}
