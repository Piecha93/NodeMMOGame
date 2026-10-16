import { PropNames } from "./SerializeDecorators";
import { ReplicatedState } from "../core/ReplicatedState";
import { legacyView } from "../replication/LegacyView";
import { calcPropsMaskByteSize, setBit } from "../utils/functions/BitOperations";

import { ProtocolLimits } from "../net/ProtocolLimits";
import { ProtocolDecodeError, ProtocolDecodeErrorCode } from "./ProtocolDecodeError";

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
    Object,
}

export abstract class Serializable extends ReplicatedState {
    declare [PropNames.SerializeFunctions]: Map<
        string,
        (object: Serializable, view: DataView, offset: number) => number
    >;
    declare [PropNames.DeserializeFunctions]: Map<
        string,
        (object: Serializable, view: DataView, offset: number) => number
    >;
    declare [PropNames.CalcBytesFunctions]: Map<string, (object: Serializable, complete: boolean) => number>;
    declare [PropNames.SerializeEncodeOrder]: Map<string, number>;
    declare [PropNames.SerializeDecodeOrder]: Map<number, string>;
    declare [PropNames.PropertyTypes]: Map<string, SerializableTypes>;
    declare [PropNames.NestedSerializableObjects]: Map<string, string>;
    declare [PropNames.DecodeCounter]: number;
    public static TypesToBytesSize: Map<SerializableTypes, number> = new Map<SerializableTypes, number>([
        [SerializableTypes.Int8, 1],
        [SerializableTypes.Int16, 2],
        [SerializableTypes.Int32, 4],
        [SerializableTypes.Uint8, 1],
        [SerializableTypes.Uint16, 2],
        [SerializableTypes.Uint32, 4],
        [SerializableTypes.Float32, 4],
        [SerializableTypes.Float64, 8],
    ]);

    protected constructor() {
        super();
    }

    protected override replicatedChildren(): readonly ReplicatedState[] {
        return Array.from(this[PropNames.NestedSerializableObjects]?.values() ?? [], (key) =>
            this.nestedSerializable(key),
        );
    }

    public calcNeededBufferSize(complete: boolean): number {
        if (this.forceComplete) {
            complete = true;
        }

        let neededSize: number = 0;

        this[PropNames.CalcBytesFunctions].forEach((func, shortKey) => {
            if (!complete && !this.changes.has(shortKey)) {
                return;
            }

            neededSize += func(this, complete);
        });

        this[PropNames.NestedSerializableObjects].forEach((key: string, short_key: string) => {
            neededSize += this.nestedSerializable(key).calcNeededBufferSize(complete);
        });

        if (neededSize != 0) {
            neededSize += this.getPropsMaskByteSize();
        }

        return neededSize;
    }

    private getPropsSize(): number {
        return this[PropNames.SerializeEncodeOrder].size;
    }

    private getPropsMaskByteSize(): number {
        let propsSize: number = this.getPropsSize();
        if (propsSize <= 0 || propsSize > ProtocolLimits.MAX_SERIALIZABLE_PROPERTIES) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.INVALID_SCHEMA,
                0,
                `unsupported property count ${propsSize}`,
            );
        }
        let propsByteSize: number = calcPropsMaskByteSize(propsSize);
        return propsByteSize == 3 ? 4 : propsByteSize;
    }

    public serialize(updateBufferView: DataView, offset: number, complete: boolean = false): number {
        // Validate all selected fields, including nested strings, before writing.
        this.calcNeededBufferSize(complete);
        const updatedOffset = this.serializeInternal(updateBufferView, offset, complete);
        // Children must retain their changes until the entire root write succeeds.
        this.commitSerializedChanges();
        return updatedOffset;
    }

    public serializePreservingChanges(updateBufferView: DataView, offset: number, complete: boolean = false): number {
        this.calcNeededBufferSize(complete);
        return this.serializeInternal(updateBufferView, offset, complete);
    }

    public commitSerializedChanges(): void {
        this.commitReplicationChanges();
    }

    private serializeInternal(updateBufferView: DataView, offset: number, complete: boolean): number {
        if (this.forceComplete) {
            complete = true;
        }

        let propsSize: number = this.getPropsSize();
        let propsMaskByteSize: number = this.getPropsMaskByteSize();

        let updatedOffset: number = offset + propsMaskByteSize;

        let presentMask: number = 0;

        if (complete) {
            presentMask = Math.pow(2, propsSize) - 1;
        }

        if (this[PropNames.SerializeFunctions]) {
            this[PropNames.SerializeFunctions].forEach((serializeFunc, shortKey) => {
                if (this.changes.has(shortKey) || complete) {
                    const index = requiredMapValue(this[PropNames.SerializeEncodeOrder], shortKey, offset);
                    updatedOffset += serializeFunc(this, updateBufferView, updatedOffset);
                    presentMask = setBit(presentMask, index);
                }
            });
        }

        if (this[PropNames.NestedSerializableObjects]) {
            this[PropNames.NestedSerializableObjects].forEach((key: string, shortKey: string) => {
                const index = requiredMapValue(this[PropNames.SerializeEncodeOrder], shortKey, offset);

                let tmpOffset: number = updatedOffset;
                updatedOffset = this.nestedSerializable(key).serializeInternal(
                    updateBufferView,
                    updatedOffset,
                    complete,
                );

                if (tmpOffset < updatedOffset) {
                    presentMask = setBit(presentMask, index);
                }
            });
        }

        if (updatedOffset == offset + propsMaskByteSize) {
            return offset;
        }

        if (propsMaskByteSize == 1) {
            updateBufferView.setUint8(offset, presentMask);
        } else if (propsMaskByteSize == 2) {
            updateBufferView.setUint16(offset, presentMask);
        } else if (propsMaskByteSize == 4) {
            updateBufferView.setUint32(offset, presentMask);
        }

        return updatedOffset;
    }

    public deserialize(updateBufferView: DataView, offset: number): number {
        this.deserializedFields.clear();

        this.lastUpdateTick = this.runtime.tick;

        let propsMaskByteSize: number = this.getPropsMaskByteSize();

        let presentMask: number = 0;
        if (propsMaskByteSize == 1) {
            presentMask = updateBufferView.getUint8(offset);
        } else if (propsMaskByteSize == 2) {
            presentMask = updateBufferView.getUint16(offset);
        } else if (propsMaskByteSize == 4) {
            presentMask = updateBufferView.getUint32(offset);
        }

        offset += propsMaskByteSize;

        let objectsToDecode: Array<number> = [];

        let index: number = 0;
        while (presentMask) {
            let bitMask: number = 1 << index;
            if ((presentMask & bitMask) == 0) {
                index++;
                continue;
            }
            presentMask &= ~bitMask;

            const shortKey = requiredMapValue(this[PropNames.SerializeDecodeOrder], index, offset);
            const type = requiredMapValue(this[PropNames.PropertyTypes], shortKey, offset);

            if (type == SerializableTypes.Object) {
                objectsToDecode.push(index);
            } else {
                offset += requiredMapValue(this[PropNames.DeserializeFunctions], shortKey, offset)(
                    this,
                    updateBufferView,
                    offset,
                );
                this.deserializedFields.add(shortKey);
            }

            index++;
        }

        objectsToDecode.forEach((index: number) => {
            const shortKey = requiredMapValue(this[PropNames.SerializeDecodeOrder], index, offset);
            const key = requiredMapValue(this[PropNames.NestedSerializableObjects], shortKey, offset);
            offset = this.nestedSerializable(key).deserialize(updateBufferView, offset);
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
        if (depth > ProtocolLimits.MAX_SERIALIZABLE_DEPTH) {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.INVALID_SCHEMA,
                offset,
                "serializable nesting limit exceeded",
            );
        }

        const propsSize: number = this.getPropsSize();
        if (propsSize <= 0 || propsSize > ProtocolLimits.MAX_SERIALIZABLE_PROPERTIES) {
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
        if (propsMaskByteSize === 1) {
            presentMask = updateBufferView.getUint8(maskOffset);
        } else if (propsMaskByteSize === 2) {
            presentMask = updateBufferView.getUint16(maskOffset);
        } else if (propsMaskByteSize === 4) {
            presentMask = updateBufferView.getUint32(maskOffset);
        } else {
            throw new ProtocolDecodeError(
                ProtocolDecodeErrorCode.INVALID_SCHEMA,
                maskOffset,
                `unsupported property mask width ${propsMaskByteSize}`,
            );
        }

        const completeMask: number = propsSize === 32 ? 0xffffffff : Math.pow(2, propsSize) - 1;
        if (presentMask === 0 || presentMask > completeMask) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.UNKNOWN_PROPERTY_MASK, maskOffset);
        }
        if (requireComplete && presentMask !== completeMask) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.INCOMPLETE_NEW_OBJECT, maskOffset);
        }

        offset += propsMaskByteSize;

        const serializeFunctions = this[PropNames.SerializeFunctions];
        const propertyTypes = this[PropNames.PropertyTypes] as Map<string, SerializableTypes>;
        const encodeOrder = this[PropNames.SerializeEncodeOrder] as Map<string, number>;

        serializeFunctions.forEach((_serializeFunction, shortKey: string) => {
            const index: number | undefined = encodeOrder.get(shortKey);
            if (index === undefined || !this.maskHasBit(presentMask, index)) {
                return;
            }

            const fieldOffset: number = offset;
            const type: SerializableTypes | undefined = propertyTypes.get(shortKey);
            if (type === SerializableTypes.String) {
                this.requirePayloadBytes(updateBufferView, fieldOffset, 1, fieldOffset);
                const stringLength: number = updateBufferView.getUint8(fieldOffset);
                this.requirePayloadBytes(updateBufferView, fieldOffset, stringLength + 1, fieldOffset);
                offset += stringLength + 1;
                return;
            }

            const fieldSize = type === undefined ? undefined : Serializable.TypesToBytesSize.get(type);
            if (fieldSize === undefined) {
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
            if (index === undefined || !this.maskHasBit(presentMask, index)) {
                return;
            }

            const nestedObject = this.nestedSerializable(key);
            if (!(nestedObject instanceof ReplicatedState)) {
                throw new ProtocolDecodeError(
                    ProtocolDecodeErrorCode.INVALID_SCHEMA,
                    offset,
                    `missing nested field '${shortKey}'`,
                );
            }
            offset = nestedObject.preflightDeserialize(updateBufferView, offset, requireComplete, depth + 1);
        });

        return offset;
    }

    private nestedSerializable(key: string): Serializable {
        const nested = Reflect.get(this, key) as unknown;
        if (!(nested instanceof ReplicatedState)) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.INVALID_SCHEMA, 0, `missing nested field '${key}'`);
        }
        return legacyView(nested);
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
        if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(byteLength) ||
            offset < 0 ||
            byteLength < 0 ||
            offset + byteLength > updateBufferView.byteLength
        ) {
            throw new ProtocolDecodeError(ProtocolDecodeErrorCode.TRUNCATED_OBJECT_PAYLOAD, errorOffset);
        }
    }
}

function requiredMapValue<K, V>(map: ReadonlyMap<K, V>, key: K, offset: number): V {
    const value = map.get(key);
    if (value === undefined) throw new ProtocolDecodeError(ProtocolDecodeErrorCode.INVALID_SCHEMA, offset, String(key));
    return value;
}
