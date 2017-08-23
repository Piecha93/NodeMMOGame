import {Serializable} from "./Serializable";

export function NetworkProperty(short_key: string, castFunction?:any) {
    function decorator(target: Object, key: string) {
        if (!target.hasOwnProperty("SerializeFunctions")) {
            Object.defineProperty(target, "SerializeFunctions", {
                value: new Map<string, Function>(),
                enumerable: true,
                configurable: true
            });
        }

        if (!target.hasOwnProperty("DeserializeFunctions")) {
            Object.defineProperty(target, "DeserializeFunctions", {
                value: new Map<string, Function>(),
                enumerable: true,
                configurable: true
            });
        }

        target['SerializeFunctions'].set(short_key, (object) => {
            if(object[key] instanceof Serializable) {
                let asd: string = object[key].serialize();
                console.log("TRANSFROM " + asd);
                return asd;
            } else {
                return '#' + short_key + ':' + object[key];
            }
        });

        target['DeserializeFunctions'].set(short_key, (object, data) => {
            if(castFunction)
                data = castFunction(data);
            object[key] = data;
        });
    }
    return decorator;
}

export function NetworkObject(target: Object, key: string) {
    if (!target.hasOwnProperty("NestedNetworkObjects")) {
        Object.defineProperty(target, "NestedNetworkObjects", {
            value: new Array<string>(),
            enumerable: true,
            configurable: true
        });
    }

    target['NestedNetworkObjects'].push(key);
}
