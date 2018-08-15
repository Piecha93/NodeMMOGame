import {PropNames} from "./NetworkDecorators";
import {SharedConfig} from "../SharedConfig";
import {maskByteSize, setBit} from "../utils/functions/BitOperations";

export enum SerializableTypes {
    Int8,
    Int16,
    Int32,
    Uint8,
    Uint16,
    Uint32,
    Float32,
    Float64,
    String,
    Object
}

export abstract class Serializable {
    public static TypesToBytesSize: Map<SerializableTypes, number> = new Map<SerializableTypes, number>(
        [
            [SerializableTypes.Int8, 1],
            [SerializableTypes.Int16, 2],
            [SerializableTypes.Int32, 4],
            [SerializableTypes.Uint8, 1],
            [SerializableTypes.Uint16, 2],
            [SerializableTypes.Uint32, 4],
            [SerializableTypes.Float32, 4],
            [SerializableTypes.Float64, 8],
        ]
    );

    protected forceComplete: boolean;
    protected changes: Set<string>;
    protected deserializedFields: Set<string>;

    protected constructor() {
        this.changes = new Set<string>();
        this.deserializedFields = new Set<string>();
        this.forceComplete = true;
    }

    public addChange(change: string) {
        if(SharedConfig.IS_SERVER) {
            this.changes.add(change);
        }
    }

    public hasChange(change: string): boolean {
        if(SharedConfig.IS_SERVER) {
            return this.changes.has(change);
        } else {
            return this.deserializedFields.has(change);
        }
    }

    get DeserializedFields():Set<string> {
        return this.deserializedFields;
    }

    public calcNeededBufferSize(complete: boolean): number {
        if (this.forceComplete) {
            complete = true;
        }

        let neededSize: number = 0;

        let propsSize: number = (this[PropNames.SerializeEncodeOrder] as Map<string, number>).size;

        this[PropNames.CalcBytesFunctions].forEach((func: Function, shortKey: string) => {
            if(!complete && !this.changes.has(shortKey)) {
                return;
            }

            neededSize += func(this, complete);
        });

        this[PropNames.NestedSerializableObjects].forEach((key: string, short_key: string) => {
            neededSize += (this[key] as Serializable).calcNeededBufferSize(complete);
        });

        if(neededSize != 0) {
            neededSize += maskByteSize(propsSize);
        }

        return neededSize;
    }

    private getPropsSize(): number {
        return this[PropNames.SerializeEncodeOrder].size;
    }

    private getPropsMaskByteSize(): number {
        let propsSize: number = this.getPropsSize();
        let propsByteSize: number = maskByteSize(propsSize);
        return propsByteSize == 3 ? 4 : propsByteSize
    }


    public serialize(updateBufferView: DataView, offset: number, complete: boolean = false): number {
        if (this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        let propsSize: number = this.getPropsSize();
        let propsMaskByteSize: number = this.getPropsMaskByteSize();

        let updatedOffset: number = offset + propsMaskByteSize;

        let presentMask: number = 0;

        if(complete) {
            presentMask = Math.pow(2, propsSize) - 1;
        }

        if(this[PropNames.SerializeFunctions]) {
            this[PropNames.SerializeFunctions].forEach((serializeFunc: Function, shortKey: string) => {
                if(this.changes.has(shortKey) || complete) {
                    let index: number = this[PropNames.SerializeEncodeOrder].get(shortKey);
                    updatedOffset += serializeFunc(this, updateBufferView, updatedOffset);
                    presentMask = setBit(presentMask, index);
                }
            });
        }

        if(this[PropNames.NestedSerializableObjects]) {
            this[PropNames.NestedSerializableObjects].forEach((key: string, shortKey: string) => {
                let index: number = this[PropNames.SerializeEncodeOrder].get(shortKey);

                let tmpOffset: number = updatedOffset;
                updatedOffset = this[key].serialize(updateBufferView, updatedOffset, complete);

                if(tmpOffset < updatedOffset) {
                    presentMask = setBit(presentMask, index);
                }
            });
        }

        if(updatedOffset == (offset + propsMaskByteSize)) {
            return offset;
        }

        if(propsMaskByteSize == 1) {
            updateBufferView.setUint8(offset, presentMask);
        } else if(propsMaskByteSize == 2) {
            updateBufferView.setUint16(offset, presentMask);
        } else if(propsMaskByteSize == 4) {
            updateBufferView.setUint32(offset, presentMask);
        }

        this.changes.clear();

        return updatedOffset;
    }

    public deserialize(updateBufferView: DataView, offset: number): number {
        this.deserializedFields.clear();

        let propsMaskByteSize: number = this.getPropsMaskByteSize();

        let presentMask: number;
        if(propsMaskByteSize == 1) {
            presentMask = updateBufferView.getUint8(offset);
        } else if(propsMaskByteSize == 2) {
            presentMask = updateBufferView.getUint16(offset);
        } else if(propsMaskByteSize == 4) {
            presentMask = updateBufferView.getUint32(offset);
        }

        offset += propsMaskByteSize;

        let objectsToDecode: Array<number> = [];

        let index: number = 0;
        while (presentMask) {
            let bitMask: number = (1 << index);
            if ((presentMask & bitMask) == 0) {
                index++;
                continue;
            }
            presentMask &= ~bitMask;

            let shortKey = this[PropNames.SerializeDecodeOrder].get(index);
            let type: SerializableTypes = this[PropNames.PropertyTypes].get(shortKey);

            if(type == SerializableTypes.Object) {
                objectsToDecode.push(index);
            } else {
                offset += this[PropNames.DeserializeFunctions].get(shortKey)(this, updateBufferView, offset);
                this.deserializedFields.add(shortKey);
            }

            index++;
        }

        objectsToDecode.forEach((index: number) => {
            let shortKey = this[PropNames.SerializeDecodeOrder].get(index);

            let key: string = this[PropNames.NestedSerializableObjects].get(shortKey);
            offset = this[key].deserialize(updateBufferView, offset);
        });

        return offset;
    }


    //TEST FUNCTIONS
    public printSerializeOrder() {
        console.log("SerializeEncodeOrder");
        this[PropNames.SerializeEncodeOrder].forEach((val: number, key: string) => {
            console.log(key + " : " + val);
        });
    }

    public printDeserializeOrder() {
        console.log("SerializeDecodeOrder");
        this[PropNames.SerializeDecodeOrder].forEach((val: number, key: string) => {
            console.log(key + " : " + val);
        });
    }
}