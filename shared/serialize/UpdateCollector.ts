import {GameObject} from "../game_utils/game/objects/GameObject";
import {SharedConfig} from "../SharedConfig";
import {GameObjectsFactory} from "../game_utils/factory/ObjectsFactory";
import {GameObjectsManager} from "../game_utils/factory/GameObjectsManager";
import {Prefabs} from "../game_utils/factory/GameObjectPrefabs";
import {ChunksManager} from "../chunks/ChunksManager";
import {Chunk} from "../chunks/Chunk";


export class UpdateCollector {
    private static OBJECT_ID_BYTES_LEN = 5;
    private static DESTROY_OBJECTS_ID = 255;

    private destroyedObjects: Map<Chunk, Set<string>> = new Map<Chunk, Set<string>>();
    private chunksManager: ChunksManager;
    private objectsManager: GameObjectsManager;
    private objectsFactory: GameObjectsFactory;

    constructor(
        chunksManager: ChunksManager,
        objectsManager: GameObjectsManager,
        objectsFactory: GameObjectsFactory
    ) {
        this.chunksManager = chunksManager;
        this.objectsManager = objectsManager;
        this.objectsFactory = objectsFactory;

        let chunks: Chunk[][] = this.chunksManager.Chunks;
        for(let i = 0; i < chunks.length; i++) {
            for(let j = 0; j < chunks[i].length; j++) {
                this.destroyedObjects.set(chunks[i][j], new Set<string>());
            }
        }
    }

    public recordCreated(gameObject: GameObject) {
        const chunk: Chunk = this.chunksManager.getObjectChunk(gameObject);
        if(!chunk) {
            return;
        }

        if(SharedConfig.IS_SERVER) {
            this.destroyedObjects.get(chunk).delete(gameObject.ID);
        }
        gameObject.forceCompleteUpdate();
    }

    public recordDestroyed(gameObject: GameObject, oldChunk: Chunk) {
        if(SharedConfig.IS_SERVER && oldChunk) {
            this.destroyedObjects.get(oldChunk).add(gameObject.ID);
        }
    }

    public collectUpdate(): Map<Chunk, ArrayBuffer> {
        let chunksUpdate: Map<Chunk, ArrayBuffer> = new Map<Chunk, ArrayBuffer>();
        let serializedObjects: Set<GameObject> = new Set<GameObject>();
        let chunksToFinalize: Array<{chunk: Chunk; resetCompleteUpdate: boolean}> = [];

        let chunks: Chunk[][] = this.chunksManager.Chunks;

        for(let i = 0; i < chunks.length; i++) {
            for (let j = 0; j < chunks[i].length; j++) {
                let chunk: Chunk = chunks[i][j];
                let hasPlayersInNeighborhood: boolean = chunk.HasPlayersInNeighborhood;
                chunksToFinalize.push({chunk, resetCompleteUpdate: hasPlayersInNeighborhood});

                //no need to send update from chunk, that doesnt have players
                if (!hasPlayersInNeighborhood) {
                    continue;
                }

                //if chunk has new players inside we need to send complete update to them
                let chunkCompleteUpdate: boolean = chunk.IsNextUpdateComplete;
                let destroyedObjectsForUpdate: Set<string> = new Set<string>(this.destroyedObjects.get(chunk));

                let neededBufferSize: number = 0;
                let objectsToUpdateMap: Map<GameObject, number> = new Map<GameObject, number>();

                chunk.Objects.forEach((gameObject: GameObject) => {
                    if(gameObject.IsDestroyed) return;
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
                    if(objectsToUpdateMap.has(gameObject)) {
                        return;
                    }
                    if(gameObject.IsDestroyed) {
                        destroyedObjectsForUpdate.add(gameObject.ID);
                        return;
                    }
                    let neededSize = gameObject.calcNeededBufferSize(chunkCompleteUpdate);
                    if (neededSize > 0) {
                        objectsToUpdateMap.set(gameObject, neededBufferSize);
                        //need 5 bits for obj ID
                        neededBufferSize += neededSize + UpdateCollector.OBJECT_ID_BYTES_LEN;
                    }
                });

                let destrotObjectsOffset: number = neededBufferSize;

                if (destroyedObjectsForUpdate.size > 0) {
                    neededBufferSize += (destroyedObjectsForUpdate.size * 5) + 1;
                }

                if (neededBufferSize == 0) {
                    continue;
                }

                let updateBuffer: ArrayBuffer = new ArrayBuffer(neededBufferSize);
                let updateBufferView: DataView = new DataView(updateBuffer);

                objectsToUpdateMap.forEach((offset: number, gameObject: GameObject) => {
                    updateBufferView.setUint8(offset, gameObject.ID.charCodeAt(0));
                    updateBufferView.setUint32(offset + 1, Number(gameObject.ID.slice(1)));

                    gameObject.serializePreservingChanges(updateBufferView, offset + 5, chunkCompleteUpdate);
                    serializedObjects.add(gameObject);
                });

                if (destroyedObjectsForUpdate.size > 0) {
                    updateBufferView.setUint8(destrotObjectsOffset++, UpdateCollector.DESTROY_OBJECTS_ID);
                    destroyedObjectsForUpdate.forEach((id: string) => {
                        updateBufferView.setUint8(destrotObjectsOffset, id.charCodeAt(0));
                        updateBufferView.setUint32(destrotObjectsOffset + 1, Number(id.slice(1)));
                        destrotObjectsOffset += 5;
                        // console.log("destroy3 " + id + ", chunk " + chunk.x + "-" + chunk.y);
                    });
                }

                chunksUpdate.set(chunk, updateBuffer);
            }
        }

        serializedObjects.forEach((gameObject: GameObject) => {
            gameObject.commitSerializedChanges();
        });

        chunksToFinalize.forEach(({chunk, resetCompleteUpdate}) => {
            if(resetCompleteUpdate) {
                chunk.IsNextUpdateComplete = false;
            }

            //no need to keep leavers or tombstones after a successful collection
            chunk.resetLeavers();
            this.destroyedObjects.get(chunk).clear();
        });

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

            let gameObject: GameObject = this.objectsManager.get(id);

            if (gameObject == null) {
                const prefabId = id[0];
                const objectDataOffset: number = offset;
                gameObject = this.objectsFactory.instantiate(
                    Prefabs.IdToPrefabNames.get(prefabId),
                    id,
                    [updateBufferView, objectDataOffset]
                );
                offset = objectDataOffset + gameObject.calcNeededBufferSize(true);
            } else {
                offset = gameObject.deserialize(updateBufferView, offset);
            }
        }
    }

    private decodeDestroyedObjects(updateBufferView: DataView, offset: number) {
        while(offset < updateBufferView.byteLength) {
            let idToRemove: string = String.fromCharCode(updateBufferView.getUint8(offset)) +
                updateBufferView.getUint32(offset + 1).toString();

            let gameObject: GameObject = this.objectsManager.get(idToRemove);
            if (gameObject) {
                gameObject.destroy();
            }
            offset += 5;
        }

        return offset;
    }
}
