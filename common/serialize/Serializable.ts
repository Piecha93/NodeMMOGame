import {PropName} from "./NetworkDecorators";
import {CommonConfig} from "../CommonConfig";
import {byteSize, setBit} from "../utils/functions/BitOperations";


export abstract class Serializable {
    public static TypesToBytesSize: Map<string, number> = new Map<string, number>(
        [
            ["Int8", 1],
            ["Int16", 2],
            ["Int32", 4],
            ["Uint8", 1],
            ["Uint16", 2],
            ["Uint32", 4],
            ["Float32", 4],
            ["Float64", 8],
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
        if(CommonConfig.IS_SERVER) {
            this.changes.add(change);
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

        let propsSize: number = (this[PropName.SerializeEncodeOrder] as Map<string, number>).size;

        (this[PropName.CalcBytesFunctions] as Map<string, Function>).forEach((func: Function, shortKey: string) => {
            if(!complete && !this.changes.has(shortKey)) {
                return;
            }

            neededSize += func(this, complete);
        });

        this[PropName.NestedNetworkObjects].forEach((key: string, short_key: string) => {
            neededSize += (this[key] as Serializable).calcNeededBufferSize(complete);
        });

        if(neededSize != 0) {
            neededSize += byteSize(propsSize);
        }

        return neededSize;
    }

    private getPropsSize(): number {
        return (this[PropName.SerializeEncodeOrder] as Map<string, number>).size;
    }

    private getPropsMaskByteSize(): number {
        let propsSize: number = this.getPropsSize();
        let propsByteSize: number = byteSize(propsSize);
        return propsByteSize == 3 ? 4 : propsByteSize
    }


    public serialize(updateBufferView: DataView, offset: number, complete: boolean = false): number {
        if (this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        let propsSize: number = this.getPropsSize();
        let propsByteSize: number = this.getPropsMaskByteSize();

        let updatedOffset: number = offset + propsByteSize;

        let presentMask: number = 0;

        if(complete) {
            presentMask = Math.pow(2, propsSize) - 1;
        }

        if(this[PropName.SerializeFunctions]) {
            this[PropName.SerializeFunctions].forEach((serializeFunc: Function, shortKey: string) => {
                if(this.changes.has(shortKey) || complete) {
                    let index: number = this[PropName.SerializeEncodeOrder].get(shortKey);
                    updatedOffset += serializeFunc(this, updateBufferView, updatedOffset);
                    presentMask = setBit(presentMask, index);
                }
            });
        }

        if(this[PropName.NestedNetworkObjects]) {
            this[PropName.NestedNetworkObjects].forEach((key: string, shortKey: string) => {
                let index: number = this[PropName.SerializeEncodeOrder].get(shortKey);

                let tmpOffset: number = updatedOffset;
                updatedOffset = this[key].serialize(updateBufferView, updatedOffset, complete);

                if(tmpOffset < updatedOffset) {
                    presentMask = setBit(presentMask, index);
                }
            });
        }

        if(updatedOffset == (offset + propsByteSize)) {
            return offset;
        }

        if(propsByteSize == 1) {
            updateBufferView.setUint8(offset, presentMask);
        } else if(propsByteSize == 2) {
            updateBufferView.setUint16(offset, presentMask);
        } else if(propsByteSize == 4) {
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

            let shortKey = this[PropName.SerializeDecodeOrder].get(index);
            let type: string = this[PropName.PropertyTypes].get(shortKey);

            if(type == "object") {
                objectsToDecode.push(index);
            } else {
                offset += this[PropName.DeserializeFunctions].get(shortKey)(this, updateBufferView, offset);
                this.deserializedFields.add(shortKey);
            }

            index++;
        }

        objectsToDecode.forEach((index: number) => {
            let shortKey = this[PropName.SerializeDecodeOrder].get(index);

            let key: string = this[PropName.NestedNetworkObjects].get(shortKey);
            offset = this[key].deserialize(updateBufferView, offset);
        });

        return offset;
    }


    //TEST FUNCTIONS
    public printSerializeOrder() {
        console.log("SerializeEncodeOrder");
        (this[PropName.SerializeEncodeOrder] as Map<string, number>).forEach((val: number, key: string) => {
            console.log(key + " : " + val);
        });
    }

    public printDeserializeOrder() {
        console.log("SerializeDecodeOrder");
        (this[PropName.SerializeDecodeOrder] as Map<string, number>).forEach((val: number, key: string) => {
            console.log(key + " : " + val);
        });
    }
}