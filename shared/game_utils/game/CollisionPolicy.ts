import { Collider } from "../physics/Collider";
import { Enemy } from "./objects/Enemy";
import { ExpeditionMarker } from "./objects/ExpeditionMarker";
import { FireBall } from "./objects/FireBall";
import { GameObject } from "./objects/GameObject";
import { Item } from "./objects/Item";
import { Player } from "./objects/Player";
import { Portal } from "./objects/Portal";

const hookNames = [
    "onCollisionEnter",
    "onCollisionStay",
    "onCollisionExit",
    "serverOnCollisionEnter",
    "serverOnCollisionStay",
    "serverOnCollisionExit",
    "sharedOnCollisionEnter",
    "sharedOnCollisionStay",
    "sharedOnCollisionExit",
    "onTriggerEnter",
    "onTriggerStay",
    "onTriggerExit",
    "serverOnTriggerEnter",
    "serverOnTriggerStay",
    "serverOnTriggerExit",
    "sharedOnTriggerEnter",
    "sharedOnTriggerStay",
    "sharedOnTriggerExit",
] as const;
const nonsolidTypes = new Map<Function, readonly unknown[]>(
    [Enemy, Player, FireBall, Item, Portal, ExpeditionMarker].map((type) => {
        const prototype = type.prototype as unknown as Record<string, unknown>;
        return [type, hookNames.map((name) => prototype[name])] as const;
    }),
);
const solidGetter = Object.getOwnPropertyDescriptor(GameObject.prototype, "IsSolid")?.get;
const colliderHooks = [
    Collider.prototype.onCollisionEnter,
    Collider.prototype.onCollisionStay,
    Collider.prototype.onCollisionExit,
];

function hasStockSolidityGetter(object: GameObject): boolean {
    let prototype: object | null = object;
    while (prototype) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "IsSolid");
        if (descriptor)
            return prototype === GameObject.prototype && descriptor.get === solidGetter && descriptor.set === undefined;
        prototype = Object.getPrototypeOf(prototype) as object | null;
    }
    return false;
}

/**
 * Conservative capability for the empty-solid-index shortcut. Custom objects,
 * subclasses, callbacks and solidity getters always keep the general broadphase.
 * Stock nonsolid entities cannot change solidity from their collision callbacks.
 */
export function mayBecomeSolid(object: GameObject): boolean {
    const hooks = nonsolidTypes.get(object.constructor);
    if (
        !hooks ||
        object.IsSolid ||
        Object.getPrototypeOf(object) !== object.constructor.prototype ||
        !hasStockSolidityGetter(object)
    )
        return true;
    const values = object as unknown as Record<string, unknown>;
    for (let index = 0; index < hookNames.length; index++) if (values[hookNames[index]!] !== hooks[index]) return true;
    for (const collider of object.Colliders)
        if (
            collider.onCollisionEnter !== colliderHooks[0] ||
            collider.onCollisionStay !== colliderHooks[1] ||
            collider.onCollisionExit !== colliderHooks[2]
        )
            return true;
    return false;
}
