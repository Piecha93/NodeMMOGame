
export function NetworkProperty(target: Object, key: string ) {
    const propertyKey: string = "_" + key;

    // console.log("NetworkProperty");

    if(!target.hasOwnProperty("serializedProperties")) {
        console.log("create serializedProperties");
        Object.defineProperty(target, "serializedProperties", {
            value: new Map(),
            enumerable: true,
            configurable: true
        });
    }

    if(!target.hasOwnProperty("networkProperties")) {
        console.log("create networkProperties");
        Object.defineProperty(target, "networkProperties", {
            value: [],
            enumerable: true,
            configurable: true
        });
    }

    target['networkProperties'].push(key);

    function getter() {
        return this[propertyKey];
    }

    function setter(newVal: any ) {
        if (this[propertyKey] != newVal) {
            this[propertyKey] = newVal;
            this["serializedProperties"].set(key, newVal);
        }
    }

    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true
    });
}