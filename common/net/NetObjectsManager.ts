import {GameObject} from "../utils/game/GameObject";
import {GameObjectsSubscriber} from "../utils/game/GameObjectsSubscriber";
import {CommonConfig} from "../CommonConfig";
import {Data} from "ejs";

export class NetObjectsManager extends GameObjectsSubscriber {
    private static instance: NetObjectsManager;

    private destroyedObjects: Array<string> = [];

    private static DESTROY_OBJECTS_ID = 255;

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
            this.destroyedObjects.push(gameObject.ID);
        }
    }

    collectUpdate(complete: boolean = false): ArrayBuffer {
        let neededBufferSize: number = 0;
        let objectsToUpdateMap: Map<GameObject, number> = new Map<GameObject, number>();

        this.GameObjectsMapById.forEach((gameObject: GameObject) => {
            let objectNeededSize = gameObject.calcNeededBufferSize(complete);
            if(objectNeededSize > 0) {
                objectsToUpdateMap.set(gameObject, neededBufferSize);
                //need 5 bits for obj ID
                neededBufferSize += objectNeededSize + 5;
            }
        });

        let destrotObjectsOffset: number = neededBufferSize;

        if(this.destroyedObjects.length > 0) {
            neededBufferSize += (this.destroyedObjects.length * 5) + 1;
        }

        let updateBuffer: ArrayBuffer = new ArrayBuffer(neededBufferSize);
        let updateBufferView: DataView = new DataView(updateBuffer);

        objectsToUpdateMap.forEach((offset: number, gameObject: GameObject) => {
            updateBufferView.setUint8(offset, gameObject.ID.charCodeAt(0));
            updateBufferView.setUint32(offset + 1, Number(gameObject.ID.slice(1)));

            gameObject.serialize(updateBufferView, offset + 5, complete);
        });

        if(this.destroyedObjects.length > 0) {
            updateBufferView.setUint8(destrotObjectsOffset++, NetObjectsManager.DESTROY_OBJECTS_ID);
            this.destroyedObjects.forEach((id: string) => {
                updateBufferView.setUint8(destrotObjectsOffset, id.charCodeAt(0));
                updateBufferView.setUint32(destrotObjectsOffset + 1, Number(id.slice(1)));
                destrotObjectsOffset += 5;
            });
        }

        this.destroyedObjects = [];



        return updateBuffer;
    }
}