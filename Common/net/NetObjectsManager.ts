import {GameObject} from "../utils/GameObject";

export class NetObjectsManager {
    private static NEXT_ID: number = 0;
    private static GetNextId(type: string): string {
        NetObjectsManager.NEXT_ID++;
        return type + NetObjectsManager.NEXT_ID.toString();
    }
    private static instance: NetObjectsManager;

    private gameObjects: Map<string, GameObject>;

    private constructor() {
        this.gameObjects = new Map<string, GameObject>();
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

    addGameObject(gameObject: GameObject, id?: string): string {
        //TODO - sprawdzic czy dany gejmobject juz istnieje
        let newObjectId: string;
        if(id != null) {
            if(this.gameObjects.has(id)) {
                throw new Error("NetObject id duplication: " + id);
            }
            newObjectId = id;
        } else {
            newObjectId = NetObjectsManager.GetNextId(gameObject.Type);
            console.log("new " + gameObject.Type);
        }
        this.gameObjects.set(newObjectId, gameObject);

        return id;
    }

    removeGameObject(id: string): boolean {
        return this.gameObjects.delete(id);
    }

    has(id: string): boolean {
        return this.gameObjects.has(id);
    }
}