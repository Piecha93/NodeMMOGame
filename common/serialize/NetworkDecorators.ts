import {Serializable, SerializableTypes} from "./Serializable";

export namespace PropName {
    export const SerializeFunctions:    string = "SerializeFunctions";
    export const DeserializeFunctions:  string = "DeserializeFunctions";
    export const CalcBytesFunctions:    string = "CalcBytesFunctions";
    export const SerializeEncodeOrder:  string = "SerializeEncodeOrder";
    export const SerializeDecodeOrder:  string = "SerializeDecodeOrder";
    export const PropertyTypes:         string = "PropertyType";
    export const DecodeCounter:         string = "DecodeCounter";
    export const NestedNetworkObjects:  string = "NestedNetworkObjects";
}

function fillString(str: string, view: DataView, offset: number) {
    view.setUint8(offset, str.length);
    for(let i = 0; i < str.length; i++) {
        view.setUint8(offset + i + 1, str.charCodeAt(i));
    }
}

function decodeString(view: DataView, offset: number): string {
    let len: number = view.getUint8(offset);

    let str: string = "";
    for(let i = 1; i <= len; i++) {
        str += String.fromCharCode(view.getUint8(i + offset));
    }
    return str;
}

export function NetworkProperty(shortKey: string, type: SerializableTypes) {
    function decorator(target: Object, key: string) {
        addNetworkProperties(target);

        let counter: number = target[PropName.DecodeCounter]++;
        target[PropName.SerializeEncodeOrder].set(shortKey, counter);
        target[PropName.SerializeDecodeOrder].set(counter, shortKey);

        target[PropName.PropertyTypes].set(shortKey, type);

        target[PropName.SerializeFunctions].set(shortKey, (object: Serializable, view: DataView, offset: number) => {
            let type: SerializableTypes = object[PropName.PropertyTypes].get(shortKey);

            if(type == SerializableTypes.string) {
                fillString(object[key], view, offset);
                return (object[key] as string).length + 1;
            } else if(type == SerializableTypes.Int8) {
                view.setInt8(offset, object[key]);
            } else if(type == SerializableTypes.Int16) {
                view.setInt16(offset, object[key]);
            } else if(type == SerializableTypes.Int32) {
                view.setInt32(offset, object[key]);
            } else if(type == SerializableTypes.Uint8) {
                view.setUint8(offset, object[key]);
            } else if(type == SerializableTypes.Uint16) {
                view.setUint16(offset, object[key]);
            } else if(type == SerializableTypes.Uint32) {
                view.setUint32(offset, object[key]);
            } else if(type == SerializableTypes.Float32) {
                view.setFloat32(offset, object[key]);
            } else if(type == SerializableTypes.Float64) {
                view.setFloat64(offset, object[key]);
            }

            return Serializable.TypesToBytesSize.get(type);
        });

        target[PropName.DeserializeFunctions].set(shortKey, (object: Serializable, view: DataView, offset: number): number => {
            if(type == SerializableTypes.string) {
                object[key] = decodeString(view, offset);
                return (object[key] as string).length + 1;
            } else if(type == SerializableTypes.Int8) {
                object[key] = view.getInt8(offset);
            } else if(type == SerializableTypes.Int16) {
                object[key] = view.getInt16(offset);
            } else if(type == SerializableTypes.Int32) {
                object[key] = view.getInt32(offset);
            } else if(type == SerializableTypes.Uint8) {
                object[key] = view.getUint8(offset);
            } else if(type == SerializableTypes.Uint16) {
                object[key] = view.getUint16(offset);
            } else if(type == SerializableTypes.Uint32) {
                object[key] = view.getUint32(offset);
            } else if(type == SerializableTypes.Float32) {
                object[key] = view.getFloat32(offset);
            } else if(type == SerializableTypes.Float64) {
                object[key] = view.getFloat64(offset);
            }

            return Serializable.TypesToBytesSize.get(type);
        });

        target[PropName.CalcBytesFunctions].set(shortKey, (object: Serializable, complete: boolean): number => {
            let type: SerializableTypes = target[PropName.PropertyTypes].get(shortKey);

            if(type == SerializableTypes.string) {
                return (object[key] as string).length + 1;
            } else if(type == SerializableTypes.object) {
                return (object[key] as Serializable).calcNeededBufferSize(complete);
            } else {
                return Serializable.TypesToBytesSize.get(type);
            }
        });
    }

    return decorator;
}

export function NetworkObject(shortKey: string) {
    function decorator(target: Object, key: string) {
        addNetworkProperties(target);

        target[PropName.PropertyTypes].set(shortKey, SerializableTypes.object);

        let counter: number = target[PropName.DecodeCounter]++;

        target[PropName.SerializeEncodeOrder].set(shortKey, counter);
        target[PropName.SerializeDecodeOrder].set(counter, shortKey);
        target[PropName.NestedNetworkObjects].set(shortKey, key);
    }

    return decorator;
}

function addNetworkProperties(target: Object) {
    createMapProperty<string, Function>(target, PropName.SerializeFunctions);
    createMapProperty<string, Function>(target, PropName.DeserializeFunctions);
    createMapProperty<string, Function>(target, PropName.CalcBytesFunctions);
    createMapProperty<string, number>(target, PropName.SerializeEncodeOrder);
    createMapProperty<number, string>(target, PropName.SerializeDecodeOrder);
    createMapProperty<string, SerializableTypes>(target, PropName.PropertyTypes);
    createMapProperty<string, number>(target, PropName.NestedNetworkObjects);

    addDcecodeCounter(target);
}


function createMapProperty<T, R>(target: Object, propertyName: string) {
    if (!target.hasOwnProperty(propertyName)) {
        let propertyVal: Map<T, R> = getPrototypePropertyVal(target, propertyName, null);
        propertyVal = new Map<T, R>(propertyVal);
        createProperty(target, propertyName, propertyVal);
    }
}

function createProperty(target: Object, propertyName: string, propertyVal: any) {
    Object.defineProperty(target, propertyName, {
        value: propertyVal,
        writable: true,
        enumerable: true,
        configurable: true
    });
}

function addDcecodeCounter(target: Object) {
    if (!target.hasOwnProperty(PropName.DecodeCounter)) {
        let propertyVal: number = getPrototypePropertyVal(target, PropName.DecodeCounter, 0);
        createProperty(target, PropName.DecodeCounter, propertyVal);
    }
}

function getPrototypePropertyVal(target: Object, propertyName: string, defaultVal: any) {
    let basePrototype: any = target;

    while (basePrototype) {
        let prototype: any = Object.getPrototypeOf(basePrototype);
        basePrototype = prototype;

        if (basePrototype && prototype.hasOwnProperty(propertyName)) {
            return prototype[propertyName]
        }
    }

    return defaultVal;
}
