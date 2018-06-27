import {GameObject} from "../utils/game/GameObject";
import {GameObjectsSubscriber} from "../utils/factory/GameObjectsSubscriber";
import {CommonConfig} from "../CommonConfig";
import {CollisionsSystem} from "../utils/physics/CollisionsSystem";
import {Player} from "../utils/game/Player";
import {GameObjectsFactory} from "../utils/factory/ObjectsFactory";
import {Types} from "../utils/factory/GameObjectTypes";

export class NetObjectsSerializer extends GameObjectsSubscriber {
    private static instance: NetObjectsSerializer;

    private destroyedObjects: Array<string> = [];

    private static DESTROY_OBJECTS_ID = 255;

    private constructor() {
        super();
    }

    static get Instance(): NetObjectsSerializer {
        if(NetObjectsSerializer.instance) {
            return NetObjectsSerializer.instance;
        } else {
            NetObjectsSerializer.instance = new NetObjectsSerializer;
            return NetObjectsSerializer.instance;
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
            updateBufferView.setUint8(destrotObjectsOffset++, NetObjectsSerializer.DESTROY_OBJECTS_ID);
            this.destroyedObjects.forEach((id: string) => {
                updateBufferView.setUint8(destrotObjectsOffset, id.charCodeAt(0));
                updateBufferView.setUint32(destrotObjectsOffset + 1, Number(id.slice(1)));
                destrotObjectsOffset += 5;
            });
        }

        this.destroyedObjects = [];

        return updateBuffer;
    }

    public decodeUpdate(updateBufferView: DataView, localPlayer: Player, collisionsSystem: CollisionsSystem) {
        let offset: number = 0;

        while(offset < updateBufferView.byteLength) {
            let id: string = String.fromCharCode(updateBufferView.getUint8(offset));

            if(id == String.fromCharCode(255)) {
                offset = NetObjectsSerializer.decodeDestroyedObjects(updateBufferView, offset + 1);
                break
            }

            id += updateBufferView.getUint32(offset + 1).toString();

            offset += 5;

            let gameObject: GameObject = NetObjectsSerializer.Instance.getGameObject(id);

            if (gameObject == null) {
                gameObject = GameObjectsFactory.Instatiate(Types.IdToClassNames.get(id[0]), id);
            }

            offset = gameObject.deserialize(updateBufferView, offset);

            if (localPlayer && localPlayer.ID == id) {
                localPlayer.reconciliation(collisionsSystem);
            }
        }
    }

    private static decodeDestroyedObjects(updateBufferView: DataView, offset: number) {
        while(offset < updateBufferView.byteLength) {
            let idToRemove: string = String.fromCharCode(updateBufferView.getUint8(offset)) +
                updateBufferView.getUint32(offset + 1).toString();

            let gameObject: GameObject = NetObjectsSerializer.Instance.getGameObject(idToRemove);
            if (gameObject) {
                gameObject.destroy();
            }
            offset += 5;
        }

        return offset;
    }
}