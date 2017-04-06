import {NetObject} from "./NetObject";
import {GameObject} from "../utils/GameObject";

export class NetObjectsManager {
    private static NEXT_ID: number = 22;
    private static GetNextId(): number {
        return NetObjectsManager.NEXT_ID++;
    }
    private static instance: NetObjectsManager;

    private netObjects: Map<number, NetObject>;

    constructor() {
        if (NetObjectsManager.instance) {
            return NetObjectsManager.instance;
        } else {
            NetObjectsManager.instance = this;
            this.netObjects = new Map<number, NetObject>();

            return this;
        }
    }

    static get Instance(): NetObjectsManager {
        return new NetObjectsManager;
    }

    serializeNetObjects(): string {
        let serializedObjects = {};
        this.netObjects.forEach((value: NetObject, key: number) => {
            serializedObjects[key] = this.netObjects.get(key);
        });
        return JSON.stringify(serializedObjects);
    }

    collectUpdate(): string {
        let serializedObjects: string = '';
        this.netObjects.forEach((value: NetObject, key: number) => {
            let netObject: NetObject = this.netObjects.get(key);
            serializedObjects += '$' + netObject.ID.toString() + '-' + netObject.GameObject.serialize().slice(1);
        });

        serializedObjects = serializedObjects.slice(1);
        return serializedObjects;
    }

    getObject(id: number) {
        return this.netObjects.get(id);
    }

    updateObjects(update: string) {
        let splitUpdate: string[] = update.split('-');
        let id: number = parseInt(splitUpdate[0]);
        let netObject: NetObject = this.netObjects.get(id);

        if(netObject != null) {
            netObject.deserialize(splitUpdate[1]);
        }
    }

    createObject(gameObject: GameObject, id?: number): NetObject {
        //TODO - sprawdzic czy dany gejmobject juz istnieje
        let newObjectId: number;
        if(id != null) {
            if(this.netObjects.has(id)) {
                throw new Error("NetObject id duplication: " + id);
            }
            newObjectId = id;
        } else {
            newObjectId = NetObjectsManager.GetNextId();
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