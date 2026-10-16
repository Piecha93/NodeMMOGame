import { ChangesDict } from "../core/ChangeKeys";
import { ReplicatedState } from "../core/ReplicatedState";
import { GameObject } from "../game_utils/game/objects/GameObject";
import { Actor } from "../game_utils/game/objects/Actor";
import { Doors } from "../game_utils/game/objects/Doors";
import { FireBall } from "../game_utils/game/objects/FireBall";
import { Portal } from "../game_utils/game/objects/Portal";
import { Transform } from "../game_utils/physics/Transform";
import { Serializable, SerializableTypes } from "../serialize/Serializable";
import { SerializableObject, SerializableProperty } from "../serialize/SerializeDecorators";

const schemas = new WeakMap<object, object>();
let registered = false;

/** Preserves the old declaration order without decorating domain prototypes. */
export function registerLegacySchemas(): void {
    if (registered) return;
    class ObjectSchema extends Serializable {
        constructor() {
            super();
        }
    }
    class ActorSchema extends ObjectSchema {}
    class DoorsSchema extends ObjectSchema {}
    class FireBallSchema extends ObjectSchema {}
    class PortalSchema extends ObjectSchema {}
    class TransformSchema extends Serializable {
        constructor() {
            super();
        }
    }
    const property = (prototype: object, key: string, shortKey: string, type: SerializableTypes) =>
        SerializableProperty(shortKey, type)(prototype, key);

    SerializableObject("pos")(ObjectSchema.prototype, "transform");
    property(ObjectSchema.prototype, "velocity", ChangesDict.VELOCITY, SerializableTypes.Float32);
    property(ObjectSchema.prototype, "invisible", "INV", SerializableTypes.Uint8);
    property(ObjectSchema.prototype, "SpriteId", ChangesDict.SPRITE_ID, SerializableTypes.Uint16);
    property(ActorSchema.prototype, "name", ChangesDict.NAME, SerializableTypes.String);
    property(ActorSchema.prototype, "maxHp", ChangesDict.MAX_HP, SerializableTypes.Uint16);
    property(ActorSchema.prototype, "hp", ChangesDict.HP, SerializableTypes.Uint16);
    property(ActorSchema.prototype, "animationType", ChangesDict.ANIMATION_TYPE, SerializableTypes.String);
    property(ActorSchema.prototype, "horizontal", ChangesDict.HORIZONTAL, SerializableTypes.Int8);
    property(ActorSchema.prototype, "vertical", ChangesDict.VERTICAL, SerializableTypes.Int8);
    property(DoorsSchema.prototype, "isOpen", ChangesDict.ISOPEN, SerializableTypes.Uint8);
    property(FireBallSchema.prototype, "power", ChangesDict.POWER, SerializableTypes.Uint16);
    property(FireBallSchema.prototype, "owner", ChangesDict.OWNER, SerializableTypes.String);
    property(PortalSchema.prototype, "isAttached", ChangesDict.IS_ATTACHED, SerializableTypes.Int8);
    property(TransformSchema.prototype, "scaleX", ChangesDict.SCALEX, SerializableTypes.Uint16);
    property(TransformSchema.prototype, "scaleY", ChangesDict.SCALEY, SerializableTypes.Uint16);
    property(TransformSchema.prototype, "x", ChangesDict.X, SerializableTypes.Float32);
    property(TransformSchema.prototype, "y", ChangesDict.Y, SerializableTypes.Float32);
    property(TransformSchema.prototype, "rotation", ChangesDict.ROTATION, SerializableTypes.Float32);
    for (const [domain, schema] of [
        [GameObject.prototype, ObjectSchema.prototype],
        [Actor.prototype, ActorSchema.prototype],
        [Doors.prototype, DoorsSchema.prototype],
        [FireBall.prototype, FireBallSchema.prototype],
        [Portal.prototype, PortalSchema.prototype],
        [Transform.prototype, TransformSchema.prototype],
    ] as const)
        schemas.set(domain, schema);
    registered = true;
}

export function legacySchemaPrototype(state: ReplicatedState): object {
    registerLegacySchemas();
    let prototype: object | null = Object.getPrototypeOf(state) as object | null;
    while (prototype) {
        const schema = schemas.get(prototype);
        if (schema) return schema;
        prototype = Object.getPrototypeOf(prototype) as object | null;
    }
    throw new TypeError("No legacy schema registered for replicated state");
}
