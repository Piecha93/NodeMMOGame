import {GameObject} from "../game_utils/game/objects/GameObject";
import {SharedConfig} from "../SharedConfig";
import {GameObjectsFactory} from "../game_utils/factory/ObjectsFactory";
import {GameObjectsManager} from "../game_utils/factory/GameObjectsManager";
import {Prefabs} from "../game_utils/factory/GameObjectPrefabs";
import {ChunksManager} from "../chunks/ChunksManager";
import {Chunk} from "../chunks/Chunk";
import {Transform} from "../game_utils/physics/Transform";
import {ProtocolLimits} from "../net/ProtocolLimits";
import {ProtocolDecodeError, ProtocolDecodeErrorCode} from "./ProtocolDecodeError";

interface DecodeRecordPlan {
    id: string;
    prefabName: string;
    dataOffset: number;
    endOffset: number;
}

interface DecodePlan {
    records: DecodeRecordPlan[];
    tombstones: string[];
}


export class UpdateCollector {
    private static OBJECT_ID_BYTES_LEN = 5;
    private static DESTROY_OBJECTS_ID = 255;

    private destroyedObjects: Map<Chunk, Set<string>> = new Map<Chunk, Set<string>>();
    private chunksManager: ChunksManager;
    private objectsManager: GameObjectsManager;
    private objectsFactory: GameObjectsFactory;
    private decodeSchemaObjects: Map<string, GameObject> = new Map<string, GameObject>();

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
        const updateBufferView: DataView = new DataView(updateBuffer);
        const plan: DecodePlan = this.preflightDecode(updateBufferView);
        this.applyDecodePlan(updateBufferView, plan);
    }

    private preflightDecode(updateBufferView: DataView): DecodePlan {
        if(updateBufferView.byteLength === 0) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.EMPTY_UPDATE, 0);
        }
        if(updateBufferView.byteLength > ProtocolLimits.MAX_UPDATE_FRAME_BYTES) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UPDATE_FRAME_LIMIT, 0);
        }

        const records: DecodeRecordPlan[] = [];
        const tombstones: string[] = [];
        const updatedIds: Set<string> = new Set<string>();
        const tombstoneIds: Set<string> = new Set<string>();
        let offset: number = 0;

        while(offset < updateBufferView.byteLength) {
            const recordOffset: number = offset;
            const prefabByte: number = updateBufferView.getUint8(recordOffset);
            if(prefabByte === UpdateCollector.DESTROY_OBJECTS_ID) {
                offset = recordOffset + 1;
                if(offset === updateBufferView.byteLength) {
                    throw new ProtocolDecodeError(
                        ProtocolDecodeErrorCode.INVALID_TOMBSTONE_SECTION,
                        recordOffset,
                    );
                }

                while(offset < updateBufferView.byteLength) {
                    const tombstoneOffset: number = offset;
                    if(updateBufferView.byteLength - tombstoneOffset < UpdateCollector.OBJECT_ID_BYTES_LEN) {
                        throw new ProtocolDecodeError(
                            ProtocolDecodeErrorCode.TRUNCATED_TOMBSTONE_ID,
                            tombstoneOffset,
                        );
                    }

                    const id: string = this.readObjectId(updateBufferView, tombstoneOffset);
                    if(!Prefabs.IdToPrefabNames.has(id[0])) {
                        throw new ProtocolDecodeError(
                            ProtocolDecodeErrorCode.UNKNOWN_PREFAB,
                            tombstoneOffset,
                        );
                    }
                    if(tombstoneIds.has(id)) {
                        throw new ProtocolDecodeError(
                            ProtocolDecodeErrorCode.DUPLICATE_TOMBSTONE_ID,
                            tombstoneOffset,
                        );
                    }
                    if(updatedIds.has(id)) {
                        throw new ProtocolDecodeError(
                            ProtocolDecodeErrorCode.UPDATE_TOMBSTONE_CONFLICT,
                            tombstoneOffset,
                        );
                    }

                    tombstoneIds.add(id);
                    tombstones.push(id);
                    if(tombstones.length > ProtocolLimits.MAX_TOMBSTONES_PER_FRAME) {
                        throw new ProtocolDecodeError(
                            ProtocolDecodeErrorCode.RECORD_LIMIT,
                            tombstoneOffset,
                        );
                    }
                    offset += UpdateCollector.OBJECT_ID_BYTES_LEN;
                }
                break;
            }

            if(updateBufferView.byteLength - recordOffset < UpdateCollector.OBJECT_ID_BYTES_LEN) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.TRUNCATED_OBJECT_HEADER,
                    recordOffset,
                );
            }

            const prefabId: string = String.fromCharCode(prefabByte);
            const prefabName: string | undefined = Prefabs.IdToPrefabNames.get(prefabId);
            const prefabType = prefabName ? Prefabs.PrefabsNameToTypes.get(prefabName) : undefined;
            if(!prefabName || !prefabType) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.UNKNOWN_PREFAB,
                    recordOffset,
                );
            }

            const id: string = this.readObjectId(updateBufferView, recordOffset);
            if(updatedIds.has(id)) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.DUPLICATE_OBJECT_ID,
                    recordOffset,
                );
            }

            const existingObject: GameObject | undefined = this.objectsManager.get(id);
            if(existingObject && !(existingObject instanceof prefabType)) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.PREFAB_MISMATCH,
                    recordOffset,
                );
            }

            const schemaObject: GameObject = existingObject ?? this.getDecodeSchemaObject(prefabName);
            const dataOffset: number = recordOffset + UpdateCollector.OBJECT_ID_BYTES_LEN;
            const endOffset: number = schemaObject.preflightDeserialize(
                updateBufferView,
                dataOffset,
                existingObject === undefined,
            );

            updatedIds.add(id);
            records.push({id, prefabName, dataOffset, endOffset});
            if(records.length > ProtocolLimits.MAX_OBJECT_RECORDS_PER_FRAME) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.RECORD_LIMIT,
                    recordOffset,
                );
            }
            offset = endOffset;
        }

        return {records, tombstones};
    }

    private applyDecodePlan(updateBufferView: DataView, plan: DecodePlan): void {
        for(const record of plan.records) {
            const gameObject: GameObject | undefined = this.objectsManager.get(record.id);
            if(gameObject) {
                const appliedEndOffset: number = gameObject.deserialize(updateBufferView, record.dataOffset);
                if(appliedEndOffset !== record.endOffset) {
                    throw new Error(
                        `Validated record '${record.id}' ended at ${record.endOffset}, ` +
                        `but deserialization ended at ${appliedEndOffset}`,
                    );
                }
            } else {
                this.objectsFactory.instantiate(
                    record.prefabName,
                    record.id,
                    [updateBufferView, record.dataOffset],
                );
            }
        }

        for(const id of plan.tombstones) {
            this.objectsManager.destroy(id);
        }
    }

    private getDecodeSchemaObject(prefabName: string): GameObject {
        let schemaObject: GameObject | undefined = this.decodeSchemaObjects.get(prefabName);
        if(schemaObject) {
            return schemaObject;
        }

        const prefabType = Prefabs.PrefabsNameToTypes.get(prefabName);
        if(!prefabType) {
            throw new Error(`Missing registered prefab schema '${prefabName}'`);
        }

        // All v1 prefabs share the Transform constructor contract. This detached
        // exemplar exposes decorator metadata without registering an object or
        // invoking any world lifecycle callbacks during protocol validation.
        schemaObject = new prefabType(new Transform([0, 0]));
        this.decodeSchemaObjects.set(prefabName, schemaObject);
        return schemaObject;
    }

    private readObjectId(updateBufferView: DataView, offset: number): string {
        return String.fromCharCode(updateBufferView.getUint8(offset)) +
            updateBufferView.getUint32(offset + 1).toString();
    }
}
