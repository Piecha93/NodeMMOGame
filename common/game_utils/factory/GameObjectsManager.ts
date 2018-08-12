import {GameObject} from "../game/objects/GameObject";

export namespace GameObjectsManager {
    export let gameObjectsMapById: Map<string, GameObject> = new Map<string, GameObject>();

    export function GetGameObjectById(id: string): GameObject {
        return gameObjectsMapById.get(id);
    }

    export function DestroyGameObjectById(id: string): boolean {
        let gameObject: GameObject = gameObjectsMapById.get(id);
        if(gameObject) {
            gameObject.destroy();
            return true;
        }
        return false;
    }
}