import {PropName} from "./NetworkDecorators";
import {CommonConfig} from "../CommonConfig";


function byteSize(num: number) {
    return Math.ceil(num.toString(2).length / 8);
}

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

    private setBit(val: number, bitIndex: number): number {
        console.log("set bit idx " + bitIndex);
        val |= (1 << bitIndex);
        return val;
    }

    public serialize(updateBufferView: DataView, offset: number, complete: boolean = false): number {
        if (this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        // let neededBufferSize = this.calcNeededBufferSize(complete);

        // let updateBuffer: ArrayBuffer = new ArrayBuffer(neededBufferSize);
        // let updateBufferView: DataView = new DataView(updateBuffer);

        let propsSize: number = (this[PropName.SerializeEncodeOrder] as Map<string, number>).size;
        let propsByteSize: number = byteSize(propsSize);

        let updatedOffset: number = offset + propsByteSize;

        let presentMask: number = 0;

        if(this[PropName.SerializeFunctions]) {
            if (complete) {
                // set all data present
                for(let i = 0; i < propsByteSize; i++) {
                    updateBufferView.setUint8(i, 255);
                }
                presentMask = Math.pow(2, propsByteSize * 8) - 1;

                this[PropName.SerializeFunctions].forEach((serializeFunc: Function, shortKey: string) => {
                    let index: number = this[PropName.SerializeEncodeOrder].get(shortKey);

                    updatedOffset += serializeFunc(this, updateBufferView, updatedOffset);
                });
            } else {
                this.changes.forEach((shortKey: string) => {
                    let index: number = this[PropName.SerializeEncodeOrder].get(shortKey);

                    presentMask = this.setBit(presentMask, index);

                    let serializeFunc: Function = this[PropName.SerializeFunctions].get(shortKey);
                    updatedOffset += serializeFunc(this, updateBufferView, updatedOffset);

                    // this.changes.delete(shortKey);
                });
            }
        }

        if(this[PropName.NestedNetworkObjects]) {
            this[PropName.NestedNetworkObjects].forEach((key: string, shortKey: string) => {
                let index: number = this[PropName.SerializeEncodeOrder].get(shortKey);

                let tmpOffset: number = this[key].serialize(updateBufferView, updatedOffset, complete);
                if(!complete && tmpOffset > updatedOffset) {
                    console.log("presentMask!! " + presentMask);
                    presentMask = this.setBit(presentMask, index);
                    updatedOffset = tmpOffset;
                    console.log("presentMask@@ " + presentMask);
                }
            });
        }

        console.log("set presentMask " + presentMask);
        if(propsByteSize == 1) {
            updateBufferView.setUint8(offset, presentMask);
        } else if(propsByteSize == 2) {
            updateBufferView.setUint16(offset, presentMask);
        } else if(propsByteSize == 3) {
            updateBufferView.setUint32(offset, presentMask);
        }

        this.changes.clear();

        return updatedOffset;
    }

    public deserialize(updateBufferView: DataView, offset: number) {
        // let decodeIdx: number = 0;
        console.log("DESERIALIZE");
        this.deserializedFields.clear();

        let propsSize: number = (this[PropName.SerializeEncodeOrder] as Map<string, number>).size;
        let propsByteSize: number = byteSize(propsSize);

        let presentMask: number;
        if(propsByteSize == 1) {
            presentMask = updateBufferView.getUint8(offset);
            offset += 1;
        } else if(propsByteSize == 2) {
            presentMask = updateBufferView.getUint16(offset);
            offset += 2;
        } else if(propsByteSize == 3) {
            presentMask = updateBufferView.getUint32(offset);
            offset += 4;
        }

        console.log("presentMask " + presentMask + " propsSize " + propsSize);

        let objectsToDecode: Array<number> = [];

        let index: number = 0;
        while (presentMask && propsSize > index) {
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
                offset += this[PropName.DeserializeFunctions].get(shortKey)(this, updateBufferView, offset)
            }

            index++;
        }

        objectsToDecode.forEach((index: number) => {
            let shortKey = this[PropName.SerializeDecodeOrder].get(index);

            let key: string = this[PropName.NestedNetworkObjects].get(shortKey);
            offset += this[key].deserialize(updateBufferView, offset);
        });

        return offset;
    }
}