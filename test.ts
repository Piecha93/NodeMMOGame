// function NetworkClass(target: Function) {
//     Object.defineProperty(target, "serializedProperties", {
//         value: new Map(),
//         enumerable: true,
//         configurable: true
//     });
//     // }
//     //
//     // if(!target.hasOwnProperty("networkProperties")) {
//     Object.defineProperty(target, "networkProperties", {
//         value: [],
//         enumerable: true,
//         configurable: true
//     });
//
// }

export function NetworkProperty(target: Object, key: string ) {
    const propertyKey: string = "_" + key;

     console.log("NetworkProperty");

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
        // console.log("asd " + this[propertyKey]  + " " + newVal);
        if (this[propertyKey] != newVal) {
            this[propertyKey] = newVal;
            target["serializedProperties"].set(key, newVal);
        }
    }

    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true
    });
}


interface NetworkObject {
    networkProperties: Array<string>;
    serializedProperties: Map<string, any>;

    serializeAll(): string;
}


class Person{
    @NetworkProperty
    public name: string;
    public surname: string;

    @NetworkProperty
    public ciulik: Array<number>;

    constructor(name : string, surname : string) {

        this.name = name;
        this.surname = surname;
        this.ciulik = [1,2,3];
    }

    set Name(name: string) {
        console.log("SET NAME " + name);
        this.name = name;
    }

    get Name(): string {
        return this.name;
    }

    serializeAll() {
        let serializedData: string = "";

        console.log(this['networkProperties']);
        for(let prop of this['networkProperties']) {
            serializedData += this[prop]
        }

        return serializedData;
    }
}



let p = new Person("remo", "jansen");
 let p2 = new Person("aaaaaaaaaaaaa", "jansen");

p.Name = "ads";
p['serializedProperties'].set("CHHHU","asdasdasd");

console.log(p['serializedProperties']);
console.log(p2['serializedProperties']);
// for(let prop of (p as any).networkProperties) {
//     console.log(p[prop]);
// }
