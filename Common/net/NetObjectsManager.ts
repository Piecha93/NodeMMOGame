import {GameObject} from "../utils/game/GameObject";
import {GameObjectsHolder} from "../utils/game/GameObjectsHolder";

export class NetObjectsManager extends GameObjectsHolder{
    private static instance: NetObjectsManager;

    private constructor() {
        super();
    }

    static get Instance(): NetObjectsManager {
        if(NetObjectsManager.instance) {
            return NetObjectsManager.instance;
        } else {
            NetObjectsManager.instance = new NetObjectsManager;
            return NetObjectsManager.instance;
        }
    }

    collectUpdate(complete: boolean = false): string {
        let serializedObjects: string = '';
        this.gameObjects.forEach((gameObject: GameObject, id: string) => {
            let objectUpdate: string = gameObject.serialize(complete).slice(1);
            if(objectUpdate != '') {
                serializedObjects += '$' + id + '-' + objectUpdate;
            }
        });

        serializedObjects = serializedObjects.slice(1);
        return serializedObjects;
    }

    getObject(id: string) {
        return this.gameObjects.get(id);
    }
}