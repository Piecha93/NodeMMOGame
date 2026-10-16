import { Serializable, SerializableTypes } from "./Serializable";

export namespace PropNames {
    export const SerializeFunctions = "SerializeFunctions";
    export const DeserializeFunctions = "DeserializeFunctions";
    export const CalcBytesFunctions = "CalcBytesFunctions";
    export const SerializeEncodeOrder = "SerializeEncodeOrder";
    export const SerializeDecodeOrder = "SerializeDecodeOrder";
    export const PropertyTypes = "PropertyType";
    export const DecodeCounter = "DecodeCounter";
    export const NestedSerializableObjects = "NestedSerializableObjects";
}

const MAX_V1_STRING_CODE_UNITS = 0xff;

function stringByteSize(str: string): number {
    if (str.length > MAX_V1_STRING_CODE_UNITS) {
        throw new RangeError(`Protocol v1 strings cannot exceed ${MAX_V1_STRING_CODE_UNITS} code units`);
    }
    return str.length + 1;
}

function fillString(str: string, view: DataView, offset: number): number {
    const byteSize = stringByteSize(str);
    view.setUint8(offset, str.length);
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i + 1, str.charCodeAt(i));
    }
    return byteSize;
}

function decodeString(view: DataView, offset: number): string {
    let len: number = view.getUint8(offset);

    let str: string = "";
    for (let i = 1; i <= len; i++) {
        str += String.fromCharCode(view.getUint8(i + offset));
    }
    return str;
}

export function SerializableProperty(shortKey: string, type: SerializableTypes) {
    function decorator(prototype: object, key: string) {
        const target = prototype as Serializable;
        addSerializableProperties(target);

        let counter: number = target[PropNames.DecodeCounter]++;
        target[PropNames.SerializeEncodeOrder].set(shortKey, counter);
        target[PropNames.SerializeDecodeOrder].set(counter, shortKey);

        target[PropNames.PropertyTypes].set(shortKey, type);

        target[PropNames.SerializeFunctions].set(shortKey, (object: Serializable, view: DataView, offset: number) => {
            const value = Reflect.get(object, key) as number;

            if (type == SerializableTypes.String) {
                return fillString(Reflect.get(object, key) as string, view, offset);
            } else if (type == SerializableTypes.Int8) {
                view.setInt8(offset, value);
            } else if (type == SerializableTypes.Int16) {
                view.setInt16(offset, value);
            } else if (type == SerializableTypes.Int32) {
                view.setInt32(offset, value);
            } else if (type == SerializableTypes.Uint8) {
                view.setUint8(offset, value);
            } else if (type == SerializableTypes.Uint16) {
                view.setUint16(offset, value);
            } else if (type == SerializableTypes.Uint32) {
                view.setUint32(offset, value);
            } else if (type == SerializableTypes.Float32) {
                view.setFloat32(offset, value);
            } else if (type == SerializableTypes.Float64) {
                view.setFloat64(offset, value);
            }

            return scalarByteSize(type);
        });

        target[PropNames.DeserializeFunctions].set(
            shortKey,
            (object: Serializable, view: DataView, offset: number): number => {
                if (type == SerializableTypes.String) {
                    const value = decodeString(view, offset);
                    Reflect.set(object, key, value);
                    return value.length + 1;
                } else if (type == SerializableTypes.Int8) {
                    Reflect.set(object, key, view.getInt8(offset));
                } else if (type == SerializableTypes.Int16) {
                    Reflect.set(object, key, view.getInt16(offset));
                } else if (type == SerializableTypes.Int32) {
                    Reflect.set(object, key, view.getInt32(offset));
                } else if (type == SerializableTypes.Uint8) {
                    Reflect.set(object, key, view.getUint8(offset));
                } else if (type == SerializableTypes.Uint16) {
                    Reflect.set(object, key, view.getUint16(offset));
                } else if (type == SerializableTypes.Uint32) {
                    Reflect.set(object, key, view.getUint32(offset));
                } else if (type == SerializableTypes.Float32) {
                    Reflect.set(object, key, view.getFloat32(offset));
                } else if (type == SerializableTypes.Float64) {
                    Reflect.set(object, key, view.getFloat64(offset));
                }

                return scalarByteSize(type);
            },
        );

        target[PropNames.CalcBytesFunctions].set(shortKey, (object: Serializable, complete: boolean): number => {
            if (type == SerializableTypes.String) {
                return stringByteSize(Reflect.get(object, key) as string);
            } else if (type == SerializableTypes.Object) {
                return (Reflect.get(object, key) as Serializable).calcNeededBufferSize(complete);
            } else {
                return scalarByteSize(type);
            }
        });
    }

    return decorator;
}

export function SerializableObject(shortKey: string) {
    function decorator(prototype: object, key: string) {
        const target = prototype as Serializable;
        addSerializableProperties(target);

        target[PropNames.PropertyTypes].set(shortKey, SerializableTypes.Object);

        let counter: number = target[PropNames.DecodeCounter]++;

        target[PropNames.SerializeEncodeOrder].set(shortKey, counter);
        target[PropNames.SerializeDecodeOrder].set(counter, shortKey);
        target[PropNames.NestedSerializableObjects].set(shortKey, key);
    }

    return decorator;
}

function scalarByteSize(type: SerializableTypes): number {
    const size = Serializable.TypesToBytesSize.get(type);
    if (size === undefined) throw new RangeError(`Unsupported scalar serialization type ${type}`);
    return size;
}

function addSerializableProperties(target: object) {
    createMapProperty(target, PropNames.SerializeFunctions);
    createMapProperty(target, PropNames.DeserializeFunctions);
    createMapProperty(target, PropNames.CalcBytesFunctions);
    createMapProperty<string, number>(target, PropNames.SerializeEncodeOrder);
    createMapProperty<number, string>(target, PropNames.SerializeDecodeOrder);
    createMapProperty<string, SerializableTypes>(target, PropNames.PropertyTypes);
    createMapProperty<string, number>(target, PropNames.NestedSerializableObjects);

    addDcecodeCounter(target);
}

function createMapProperty<T, R>(target: object, propertyName: string) {
    if (!Object.prototype.hasOwnProperty.call(target, propertyName)) {
        const inherited = getPrototypePropertyVal<ReadonlyMap<T, R> | undefined>(target, propertyName, undefined);
        const propertyVal = new Map<T, R>(inherited);
        createProperty(target, propertyName, propertyVal);
    }
}

function createProperty(target: object, propertyName: string, propertyVal: unknown) {
    Object.defineProperty(target, propertyName, {
        value: propertyVal,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}

function addDcecodeCounter(target: object) {
    if (!Object.prototype.hasOwnProperty.call(target, PropNames.DecodeCounter)) {
        const propertyVal = getPrototypePropertyVal(target, PropNames.DecodeCounter, 0);
        createProperty(target, PropNames.DecodeCounter, propertyVal);
    }
}

function getPrototypePropertyVal<T>(target: object, propertyName: string, defaultVal: T): T {
    let prototype: object | null = Object.getPrototypeOf(target) as object | null;
    while (prototype) {
        if (Object.prototype.hasOwnProperty.call(prototype, propertyName)) {
            return Reflect.get(prototype, propertyName) as T;
        }
        prototype = Object.getPrototypeOf(prototype) as object | null;
    }

    return defaultVal;
}
