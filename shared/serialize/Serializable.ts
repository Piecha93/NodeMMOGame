import {PropNames} from "./SerializeDecorators";
import {SharedConfig} from "../SharedConfig";
import {calcPropsMaskByteSize, setBit} from "../utils/functions/BitOperations";
import {TicksCounter} from "../utils/TicksCounter";
import {ProtocolLimits} from "../net/ProtocolLimits";
import {ProtocolDecodeError, ProtocolDecodeErrorCode} from "./ProtocolDecodeError";

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
    protected lastUpdateTick: number = 0;

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
            neededSize += calcPropsMaskByteSize(propsSize);
        }

        return neededSize;
    }

    private getPropsSize(): number {
        return this[PropNames.SerializeEncodeOrder].size;
    }

    private getPropsMaskByteSize(): number {
        let propsSize: number = this.getPropsSize();
        let propsByteSize: number = calcPropsMaskByteSize(propsSize);
        return propsByteSize == 3 ? 4 : propsByteSize
    }


    public serialize(updateBufferView: DataView, offset: number, complete: boolean = false): number {
        return this.serializeInternal(updateBufferView, offset, complete, true);
    }

    public serializePreservingChanges(
        updateBufferView: DataView,
        offset: number,
        complete: boolean = false
    ): number {
        return this.serializeInternal(updateBufferView, offset, complete, false);
    }

    public commitSerializedChanges(): void {
        this.forceComplete = false;
        this.changes.clear();

        if(this[PropNames.NestedSerializableObjects]) {
            this[PropNames.NestedSerializableObjects].forEach((key: string) => {
                (this[key] as Serializable).commitSerializedChanges();
            });
        }
    }

    private serializeInternal(
        updateBufferView: DataView,
        offset: number,
        complete: boolean,
        commitChanges: boolean
    ): number {
        if (this.forceComplete) {
            if(commitChanges) {
                this.forceComplete = false;
            }
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
                updatedOffset = (this[key] as Serializable).serializeInternal(
                    updateBufferView,
                    updatedOffset,
                    complete,
                    commitChanges
                );

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

        if(commitChanges) {
            this.changes.clear();
        }

        return updatedOffset;
    }

    public deserialize(updateBufferView: DataView, offset: number): number {
        this.deserializedFields.clear();

        this.lastUpdateTick = TicksCounter.Instance.LastTickNumber;

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

    /**
     * Validates one v1 payload without invoking any deserializer or mutating
     * object state. The wire format writes scalar fields first and nested
     * Serializable objects afterwards, irrespective of their mask bit order.
     */
    public preflightDeserialize(
        updateBufferView: DataView,
        offset: number,
        requireComplete: boolean = false,
        depth: number = 0,
    ): number {
        if(depth > ProtocolLimits.MAX_SERIALIZABLE_DEPTH) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.INVALID_SCHEMA,
                offset,
                "serializable nesting limit exceeded",
            );
        }

        const propsSize: number = this.getPropsSize();
        if(propsSize <= 0 || propsSize > ProtocolLimits.MAX_SERIALIZABLE_PROPERTIES) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.INVALID_SCHEMA,
                offset,
                `unsupported property count ${propsSize}`,
            );
        }

        const maskOffset: number = offset;
        const propsMaskByteSize: number = this.getPropsMaskByteSize();
        this.requirePayloadBytes(updateBufferView, maskOffset, propsMaskByteSize, maskOffset);

        let presentMask: number;
        if(propsMaskByteSize === 1) {
            presentMask = updateBufferView.getUint8(maskOffset);
        } else if(propsMaskByteSize === 2) {
            presentMask = updateBufferView.getUint16(maskOffset);
        } else if(propsMaskByteSize === 4) {
            presentMask = updateBufferView.getUint32(maskOffset);
        } else {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.INVALID_SCHEMA,
                maskOffset,
                `unsupported property mask width ${propsMaskByteSize}`,
            );
        }

        const completeMask: number = propsSize === 32
            ? 0xFFFFFFFF
            : Math.pow(2, propsSize) - 1;
        if(presentMask === 0 || presentMask > completeMask) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.UNKNOWN_PROPERTY_MASK,
                maskOffset,
            );
        }
        if(requireComplete && presentMask !== completeMask) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.INCOMPLETE_NEW_OBJECT,
                maskOffset,
            );
        }

        offset += propsMaskByteSize;

        const serializeFunctions = this[PropNames.SerializeFunctions] as Map<string, Function>;
        const propertyTypes = this[PropNames.PropertyTypes] as Map<string, SerializableTypes>;
        const encodeOrder = this[PropNames.SerializeEncodeOrder] as Map<string, number>;

        serializeFunctions.forEach((_serializeFunction: Function, shortKey: string) => {
            const index: number | undefined = encodeOrder.get(shortKey);
            if(index === undefined || !this.maskHasBit(presentMask, index)) {
                return;
            }

            const fieldOffset: number = offset;
            const type: SerializableTypes | undefined = propertyTypes.get(shortKey);
            if(type === SerializableTypes.String) {
                this.requirePayloadBytes(updateBufferView, fieldOffset, 1, fieldOffset);
                const stringLength: number = updateBufferView.getUint8(fieldOffset);
                this.requirePayloadBytes(updateBufferView, fieldOffset, stringLength + 1, fieldOffset);
                offset += stringLength + 1;
                return;
            }

            const fieldSize: number | undefined = Serializable.TypesToBytesSize.get(type);
            if(fieldSize === undefined) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.INVALID_SCHEMA,
                    fieldOffset,
                    `unsupported scalar field '${shortKey}'`,
                );
            }
            this.requirePayloadBytes(updateBufferView, fieldOffset, fieldSize, fieldOffset);
            offset += fieldSize;
        });

        const nestedObjects = this[PropNames.NestedSerializableObjects] as Map<string, string>;
        nestedObjects.forEach((key: string, shortKey: string) => {
            const index: number | undefined = encodeOrder.get(shortKey);
            if(index === undefined || !this.maskHasBit(presentMask, index)) {
                return;
            }

            const nestedObject = this[key] as Serializable;
            if(!(nestedObject instanceof Serializable)) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.INVALID_SCHEMA,
                    offset,
                    `missing nested field '${shortKey}'`,
                );
            }
            offset = nestedObject.preflightDeserialize(
                updateBufferView,
                offset,
                requireComplete,
                depth + 1,
            );
        });

        return offset;
    }

    private maskHasBit(mask: number, index: number): boolean {
        return Math.floor(mask / Math.pow(2, index)) % 2 === 1;
    }

    private requirePayloadBytes(
        updateBufferView: DataView,
        offset: number,
        byteLength: number,
        errorOffset: number,
    ): void {
        if(
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(byteLength) ||
            offset < 0 ||
            byteLength < 0 ||
            offset + byteLength > updateBufferView.byteLength
        ) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.TRUNCATED_OBJECT_PAYLOAD,
                errorOffset,
            );
        }
    }

    get DeserializedFields():Set<string> {
        return this.deserializedFields;
    }

    get LastUpdateTick(): number {
        return this.lastUpdateTick;
    }
}
