import {NetObject} from "./NetObject";
import {GameObject} from "../utils/GameObject";

export class NetObjectsManager {
    private static NEXT_ID: number = 0;
    private static GetNextId(type: string): string {
        NetObjectsManager.NEXT_ID++;
        return type + NetObjectsManager.NEXT_ID.toString();
    }
    private static instance: NetObjectsManager;

    private netObjects: Map<string, NetObject>;

    private constructor() {
        this.netObjects = new Map<string, NetObject>();
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
        this.netObjects.forEach((value: NetObject, key: string) => {
            let netObject: NetObject = this.netObjects.get(key);
            let objectUpdate: string = netObject.GameObject.serialize(complete).slice(1);
            if(objectUpdate != '') {
                serializedObjects += '$' + netObject.ID + '-' + objectUpdate;
            }
        });

        serializedObjects = serializedObjects.slice(1);
        return serializedObjects;
    }

    getObject(id: string) {
        return this.netObjects.get(id);
    }

    createObject(gameObject: GameObject, id?: string): NetObject {
        //TODO - sprawdzic czy dany gejmobject juz istnieje
        let newObjectId: string;
        if(id != null) {
            if(this.netObjects.has(id)) {
                throw new Error("NetObject id duplication: " + id);
            }
            newObjectId = id;
        } else {
            newObjectId = NetObjectsManager.GetNextId(gameObject.Type);
        }

        let netObject: NetObject = new NetObject(newObjectId, gameObject);
        this.netObjects.set(netObject.ID, netObject);

        return netObject;
    }

    has(id: string): boolean {
        return this.netObjects.has(id);
    }

    removeObject(id: string): boolean {
        return this.netObjects.delete(id);
    }
}