import {NetObject} from "./NetObject";
import {isUndefined} from "util";
import {GameObject} from "../utils/GameObject";

export class NetObjectsManager {
    private static instance: NetObjectsManager;

    private netObjects: Map<string, NetObject>;

    constructor() {
        if(NetObjectsManager.instance) {
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

    serializeNetObjects(): string {
        let serializedObjects = {};
        this.netObjects.forEach((value: NetObject, key: string) => {
            serializedObjects[key] = this.netObjects.get(key);
        });
        return JSON.stringify(serializedObjects);
    }

    addObject(netObject: NetObject) {
        if(!this.netObjects.has(netObject.ID)) {
            this.netObjects.set(netObject.ID, netObject);
        }
    }

    updateArray(netObjectsArray) {

    }

    updateObject(netObject): GameObject {
        if(isUndefined(netObject.id) || isUndefined(netObject.gameObject)) {
            return null;
        }
        if(this.netObjects.has(netObject.id)) {
            this.netObjects.get(netObject.id).deserialize(netObject);
        } else {
            let newNetObject: NetObject = new NetObject(netObject.id).deserialize(netObject);
            this.netObjects.set(netObject.id, newNetObject);
            return newNetObject.GameObject;
        }

        return null;
    }
}