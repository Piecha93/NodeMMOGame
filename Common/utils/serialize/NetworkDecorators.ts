import {Serializable} from "./Serializable";

function createMapProperty(target: Object, propertyName: string) {
    if (!target.hasOwnProperty(propertyName)) {
        let prototype: any = Object.getPrototypeOf(target);
        let propertyVal: Map<string, Function>;
        if(prototype.hasOwnProperty(propertyName)) {
            propertyVal = new Map<string, Function>(prototype[propertyName])
        } else {
            propertyVal = new Map<string, Function>();
        }

        Object.defineProperty(target, propertyName, {
            value: propertyVal,
            enumerable: true,
            configurable: true
        });
    }
}

export function NetworkProperty(short_key: string, castFunction?:any) {
    function decorator(target: Object, key: string) {

        createMapProperty(target, "SerializeFunctions");
        createMapProperty(target, "DeserializeFunctions");

        target["SerializeFunctions"].set(short_key, (object) => {
            if(object[key] instanceof Serializable) {
                return object[key].serialize();
            } else {
                return '#' + short_key + ':' + object[key];
            }
        });

        target['DeserializeFunctions'].set(short_key, (object, data) => {
            if(castFunction)
                object[key] = castFunction(data);
            else
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
