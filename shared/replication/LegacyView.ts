import { ReplicatedState } from "../core/ReplicatedState";
import { Serializable } from "../serialize/Serializable";
import { PropNames } from "../serialize/SerializeDecorators";
import { legacySchemaPrototype } from "./LegacySchemas";
import { ResourcesMap } from "../game_utils/ResourcesMap";

const views = new WeakMap<ReplicatedState, Serializable>();
let metadataKeys: ReadonlySet<string> | undefined;

/** Adapts domain state to v1 without adding codec methods to its object/prototype. */
export function legacyView(state: ReplicatedState): Serializable {
    if (state instanceof Serializable) return state;
    const cached = views.get(state);
    if (cached) return cached;
    const schema = legacySchemaPrototype(state);
    const keys = (metadataKeys ??= new Set<string>(Object.values(PropNames)));
    const overrides = new Map<PropertyKey, unknown>();
    const proxy = new Proxy(state, {
        get(target, key, receiver): unknown {
            if (overrides.has(key)) return overrides.get(key);
            if (key === "SpriteId") {
                const spriteName = Reflect.get(target, "spriteName") as string;
                const id = ResourcesMap.NameToId.get(spriteName);
                if (id === undefined) throw new RangeError(`Unknown sprite name: ${spriteName}`);
                return id;
            }
            if (typeof key === "string" && keys.has(key)) return Reflect.get(schema, key) as unknown;
            if (Reflect.has(target, key)) return Reflect.get(target, key, receiver) as unknown;
            return Reflect.get(Serializable.prototype, key, receiver) as unknown;
        },
        set(target, key, value, receiver): boolean {
            if (key === "SpriteId") {
                const name = ResourcesMap.IdToName.get(value as number);
                if (name === undefined) throw new RangeError(`Unknown sprite id: ${String(value)}`);
                return Reflect.set(target, "spriteName", name);
            }
            // Adapter-local method replacement supports fault-injection tests;
            // it never installs serialization methods on the domain object.
            if (typeof value === "function" && Object.prototype.hasOwnProperty.call(Serializable.prototype, key)) {
                overrides.set(key, value);
                return true;
            }
            return Reflect.set(target, key, value, receiver);
        },
    }) as unknown as Serializable;
    views.set(state, proxy);
    return proxy;
}
