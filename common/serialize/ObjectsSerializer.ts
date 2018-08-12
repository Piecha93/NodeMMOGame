import {GameObject} from "../game_utils/game/objects/GameObject";
import {Chunk} from "../game_utils/chunks/Chunk";
import {GameObjectsFactory} from "../game_utils/factory/ObjectsFactory";
import {Types} from "../game_utils/factory/GameObjectTypes";

export class ObjectsSerializer {
    private static OBJECT_ID_BYTES_LEN = 5;

    static serializeObject(gameObject: GameObject): DataView {
        let objectNeededSize = gameObject.calcNeededBufferSize(true) + 5;
        let updateBuffer: ArrayBuffer = new ArrayBuffer(objectNeededSize );
        let updateBufferView: DataView = new DataView(updateBuffer);

        updateBufferView.setUint8(0, gameObject.ID.charCodeAt(0));
        updateBufferView.setUint32(1, Number(gameObject.ID.slice(1)));
        gameObject.serialize(updateBufferView, 5, true);

        return updateBufferView;
    }

    static serializeChunk(chunk: Chunk): ArrayBuffer {
        let chunkCompleteUpdate: boolean = true;
        let neededBufferSize: number = 0;
        let objectsToUpdateMap: Map<GameObject, number> = new Map<GameObject, number>();

        chunk.Objects.forEach((gameObject: GameObject) => {
            let neededSize = gameObject.calcNeededBufferSize(chunkCompleteUpdate);
            if (neededSize > 0) {
                objectsToUpdateMap.set(gameObject, neededBufferSize);
                //need 5 bits for obj ID
                neededBufferSize += neededSize + ObjectsSerializer.OBJECT_ID_BYTES_LEN;
            }
        });

        let updateBuffer: ArrayBuffer = new ArrayBuffer(neededBufferSize);
        let updateBufferView: DataView = new DataView(updateBuffer);

        objectsToUpdateMap.forEach((offset: number, gameObject: GameObject) => {
            updateBufferView.setUint8(offset, gameObject.ID.charCodeAt(0));
            updateBufferView.setUint32(offset + 1, Number(gameObject.ID.slice(1)));

            gameObject.serialize(updateBufferView, offset + ObjectsSerializer.OBJECT_ID_BYTES_LEN,
                chunkCompleteUpdate);
        });

        return updateBuffer;
    }

    static deserializeChunk(updateBuffer: ArrayBuffer) {
        let updateBufferView: DataView = new DataView(updateBuffer);
        let offset: number = 0;

        while(offset < updateBufferView.byteLength) {
            let id: string = String.fromCharCode(updateBufferView.getUint8(offset));

            id += updateBufferView.getUint32(offset + 1).toString();
            offset += 5;

            let gameObject: GameObject = GameObjectsFactory.Instatiate(Types.IdToClassNames.get(id[0]), undefined,
                [updateBufferView, offset]);

            offset = gameObject.deserialize(updateBufferView, offset);
        }
    }
}