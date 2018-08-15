import {GameObject} from "../game_utils/game/objects/GameObject";
import {GameObjectsSubscriber} from "../game_utils/factory/GameObjectsSubscriber";
import {SharedConfig} from "../SharedConfig";
import {GameObjectsFactory} from "../game_utils/factory/ObjectsFactory";
import {Types} from "../game_utils/factory/GameObjectTypes";
import {ChunksManager} from "../game_utils/chunks/ChunksManager";
import {Chunk} from "../game_utils/chunks/Chunk";


export class UpdateCollector extends GameObjectsSubscriber {
    private static OBJECT_ID_BYTES_LEN = 5;
    private static DESTROY_OBJECTS_ID = 255;

    private destroyedObjects: Map<Chunk, Array<string> >;
    private chunksManager: ChunksManager;

    constructor(chunksManager: ChunksManager) {
        super();

        this.chunksManager = chunksManager;

        if(SharedConfig.IS_SERVER) {
            this.destroyedObjects = new Map<Chunk, Array<string>>();

            let chunks: Chunk[][] = this.chunksManager.Chunks;
            for(let i = 0; i < chunks.length; i++) {
                for(let j = 0; j < chunks[i].length; j++) {
                    this.destroyedObjects.set(chunks[i][j], []);
                }
            }
        }
    }

    protected onObjectDestroy(gameObject: GameObject) {
        if(SharedConfig.IS_SERVER) {
            let chunk: Chunk = this.chunksManager.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);

            if(!chunk) {
                // console.log("WARNING! destroyed object that doesn't belong to any chunk");
                return;
            }

            this.destroyedObjects.get(chunk).push(gameObject.ID);
        }
    }

    public collectUpdate(): Map<Chunk, ArrayBuffer> {
        let chunksUpdate: Map<Chunk, ArrayBuffer> = new Map<Chunk, ArrayBuffer>();

        let chunks: Chunk[][] = this.chunksManager.Chunks;

        for(let i = 0; i < chunks.length; i++) {
            for (let j = 0; j < chunks[i].length; j++) {
                let chunk: Chunk = chunks[i][j];
                //no need to send update from chunk, that doesnt have players
                if (!chunk.HasPlayersInNeighborhood) {

                    //no need to keep leavers if there is no one to send them
                    chunk.resetLeavers();
                    this.destroyedObjects.set(chunk, []);
                    continue;
                }

                //if chunk has new players inside we need to send complete update to them
                let chunkCompleteUpdate: boolean = chunk.HasNewcomersInNeighborhood;
                let neededBufferSize: number = 0;
                let objectsToUpdateMap: Map<GameObject, number> = new Map<GameObject, number>();

                chunk.Objects.forEach((gameObject: GameObject) => {
                    let neededSize = gameObject.calcNeededBufferSize(chunkCompleteUpdate);
                    if (neededSize > 0) {
                        objectsToUpdateMap.set(gameObject, neededBufferSize);
                        //need 5 bits for obj ID
                        neededBufferSize += neededSize + UpdateCollector.OBJECT_ID_BYTES_LEN;
                    }
                });

                //when object leaves chunk, we need to send his position last time to clients,
                //so they are able to detect object is no longer in their chunks
                chunk.Leavers.forEach((gameObject: GameObject) => {
                    let neededSize = gameObject.calcNeededBufferSize(chunkCompleteUpdate);
                    if (neededSize > 0) {
                        objectsToUpdateMap.set(gameObject, neededBufferSize);
                        //need 5 bits for obj ID
                        neededBufferSize += neededSize + UpdateCollector.OBJECT_ID_BYTES_LEN;
                    }
                });

                let destrotObjectsOffset: number = neededBufferSize;

                if (this.destroyedObjects.get(chunk).length > 0) {
                    neededBufferSize += (this.destroyedObjects.get(chunk).length * 5) + 1;
                }

                if(neededBufferSize == 0) {
                    continue;
                }

                let updateBuffer: ArrayBuffer = new ArrayBuffer(neededBufferSize);
                let updateBufferView: DataView = new DataView(updateBuffer);

                objectsToUpdateMap.forEach((offset: number, gameObject: GameObject) => {
                    updateBufferView.setUint8(offset, gameObject.ID.charCodeAt(0));
                    updateBufferView.setUint32(offset + 1, Number(gameObject.ID.slice(1)));

                    gameObject.serialize(updateBufferView, offset + 5, chunkCompleteUpdate);
                });

                if (this.destroyedObjects.get(chunk).length > 0) {
                    updateBufferView.setUint8(destrotObjectsOffset++, UpdateCollector.DESTROY_OBJECTS_ID);
                    this.destroyedObjects.get(chunk).forEach((id: string) => {
                        updateBufferView.setUint8(destrotObjectsOffset, id.charCodeAt(0));
                        updateBufferView.setUint32(destrotObjectsOffset + 1, Number(id.slice(1)));
                        destrotObjectsOffset += 5;
                    });
                }

                chunk.resetLeavers();
                this.destroyedObjects.set(chunk, []);
                chunksUpdate.set(chunk, updateBuffer);
            }
        }

        return chunksUpdate;
    }

    public decodeUpdate(updateBuffer: ArrayBuffer) {
        let updateBufferView: DataView = new DataView(updateBuffer);
        let offset: number = 0;

        while(offset < updateBufferView.byteLength) {
            let id: string = String.fromCharCode(updateBufferView.getUint8(offset));

            if(id == String.fromCharCode(UpdateCollector.DESTROY_OBJECTS_ID)) {
                offset = this.decodeDestroyedObjects(updateBufferView, offset + 1);
                break;
            }

            id += updateBufferView.getUint32(offset + 1).toString();

            offset += 5;

            let gameObject: GameObject = this.getGameObject(id);

            if (gameObject == null) {
                gameObject = GameObjectsFactory.Instatiate(Types.IdToClassNames.get(id[0]), id);
            }

            offset = gameObject.deserialize(updateBufferView, offset);
        }
    }

    private decodeDestroyedObjects(updateBufferView: DataView, offset: number) {
        while(offset < updateBufferView.byteLength) {
            let idToRemove: string = String.fromCharCode(updateBufferView.getUint8(offset)) +
                updateBufferView.getUint32(offset + 1).toString();

            let gameObject: GameObject = this.getGameObject(idToRemove);
            if (gameObject) {
                gameObject.destroy();
            }
            offset += 5;
        }

        return offset;
    }
}