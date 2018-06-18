import {GameObject} from "../utils/game/GameObject";
import {GameObjectsSubscriber} from "../utils/game/GameObjectsSubscriber";
import {CommonConfig} from "../CommonConfig";

export class NetObjectsManager extends GameObjectsSubscriber {
    private static instance: NetObjectsManager;

    private destroyedObjects: string = "";

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

    protected onObjectDestroy(gameObject: GameObject) {
        if(CommonConfig.IS_SERVER) {
            this.destroyedObjects += '$' + '!' + gameObject.ID;
        }
    }

    collectUpdate(complete: boolean = false): string {
        let serializedObjects: string = '';
        this.GameObjectsMapById.forEach((gameObject: GameObject, id: string) => {
            let objectUpdate: string = gameObject.serialize(complete);
            if(objectUpdate != '') {
                serializedObjects += '$' + id + '=' + objectUpdate;
            }
        });

        serializedObjects = serializedObjects.slice(1);

        serializedObjects += this.destroyedObjects;
        this.destroyedObjects = "";

        if(serializedObjects[0] == "$") {
            serializedObjects = serializedObjects.slice(1);
        }

        return serializedObjects;
    }
}