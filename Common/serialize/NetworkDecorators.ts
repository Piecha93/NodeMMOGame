export namespace PropName {
    export const SerializeFunctions: string = "SerializeFunctions";
    export const DeserializeFunctions: string = "DeserializeFunctions";
    export const SerializeEncodeOrder: string = "SerializeEncodeOrder";
    export const SerializeDecodeOrder: string = "SerializeDecodeOrder";
    export const DecodeCounter: string = "DecodeCounter";
    export const NestedNetworkObjects: string = "NestedNetworkObjects";
}

export function NetworkProperty(shortKey: string) {
    function decorator(target: Object, key: string) {
        addNetworkProperties(target);

        let counter: number = target[PropName.DecodeCounter]++;
        target[PropName.SerializeEncodeOrder].set(shortKey, counter);
        target[PropName.SerializeDecodeOrder].set(counter, shortKey);

        target[PropName.SerializeFunctions].set(shortKey, (object) => {
            if (typeof object[key] == "number") {
                return object[key].toFixed(4);
            }  else {
                return object[key];
            }
        });

        target[PropName.DeserializeFunctions].set(shortKey, (object, data) => {
            if (typeof object[key] == "number") {
                object[key] = Number(data);
            } else {
                object[key] = data;
            }
        });
    }

    return decorator;
}

export function NetworkObject(shortKey: string) {
    function decorator(target: Object, key: string) {
        addNetworkProperties(target);

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
    createMapProperty<string, number>(target, PropName.SerializeEncodeOrder);
    createMapProperty<number, string>(target, PropName.SerializeDecodeOrder);
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
    let prototype: any = Object.getPrototypeOf(target);
    if (prototype.hasOwnProperty(propertyName)) {
        return prototype[propertyName]
    } else {
        return defaultVal;
    }
}
