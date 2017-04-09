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

    constructor() {
        if (NetObjectsManager.instance) {
            return NetObjectsManager.instance;
        } else {
            NetObjectsManager.instance = this;
            this.netObjects = new Map<string, NetObject>();

            return this;
        }
    }

    static get Instance(): NetObjectsManager {
        return new NetObjectsManager;
    }

    collectUpdate(): string {
        let serializedObjects: string = '';
        this.netObjects.forEach((value: NetObject, key: string) => {
            let netObject: NetObject = this.netObjects.get(key);
            serializedObjects += '$' + netObject.ID + '-' + netObject.GameObject.serialize().slice(1);
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

    // updateObject(netObject): GameObject {
    //     if (isUndefined(netObject.id) || isUndefined(netObject.gameObject)) {
    //         return null;
    //     }
    //     if (this.netObjects.has(netObject.id)) {
    //         this.netObjects.get(netObject.id).deserialize(netObject);
    //     } else {
    //         let newNetObject: NetObject = new NetObject(netObject.id).deserialize(netObject);
    //         this.netObjects.set(netObject.id, newNetObject);
    //         return newNetObject.GameObject;
    //     }
    //
    //     return null;
    // }
}