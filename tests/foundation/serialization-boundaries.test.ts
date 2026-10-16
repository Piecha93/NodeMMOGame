import assert from "node:assert/strict";
import { test } from "node:test";

import { SerializableObject, SerializableProperty } from "../../shared/serialize/SerializeDecorators";
import { Serializable, SerializableTypes } from "../../shared/serialize/Serializable";

function numericPacketType(propertyCount: number) {
    class NumericPacket extends Serializable {
        constructor() {
            super();
            for (let index = 0; index < propertyCount; index++) {
                Reflect.set(this, `p${index}`, index + 1);
            }
        }

        setValue(index: number, value: number): void {
            Reflect.set(this, `p${index}`, value);
            this.addChange(`p${index}`);
        }

        values(): number[] {
            return Array.from({ length: propertyCount }, (_, index) => Reflect.get(this, `p${index}`) as number);
        }
    }

    for (let index = 0; index < propertyCount; index++) {
        const key = `p${index}`;
        SerializableProperty(key, SerializableTypes.Uint8)(NumericPacket.prototype, key);
    }

    return NumericPacket;
}

function maskBytes(mask: number, byteLength: number): number[] {
    return Array.from(
        { length: byteLength },
        (_, index) => Math.floor(mask / Math.pow(256, byteLength - index - 1)) % 256,
    );
}

class NumberPacket extends Serializable {
    @SerializableProperty("value", SerializableTypes.Uint8)
    public value: number;

    constructor(value: number) {
        super();
        this.value = value;
    }
}

class NestedPacket extends Serializable {
    @SerializableObject("first")
    public first = new NumberPacket(11);

    @SerializableObject("second")
    public second = new NumberPacket(22);

    constructor() {
        super();
    }
}

class InheritedPacketBase extends Serializable {
    @SerializableObject("child")
    public child = new NumberPacket(11);

    @SerializableProperty("base", SerializableTypes.Uint16)
    public base = 0x1234;

    constructor() {
        super();
    }
}

class InheritedPacket extends InheritedPacketBase {
    @SerializableProperty("derived", SerializableTypes.Uint8)
    public derived = 0x56;

    @SerializableProperty("tail", SerializableTypes.Uint16)
    public tail = 0x789a;
}

function encode(packet: Serializable, complete: boolean = false): Uint8Array {
    const buffer = new ArrayBuffer(packet.calcNeededBufferSize(complete));
    assert.equal(packet.serialize(new DataView(buffer), 0, complete), buffer.byteLength);
    return new Uint8Array(buffer);
}

test("foundation/serialization: property-mask boundaries preserve complete and delta bytes", async (t) => {
    for (const propertyCount of [8, 9, 16, 17, 24, 25, 32]) {
        await t.test(`${propertyCount} properties`, () => {
            const Packet = numericPacketType(propertyCount);
            const source = new Packet();
            const target = new Packet();
            const maskByteLength = propertyCount <= 8 ? 1 : propertyCount <= 16 ? 2 : 4;
            const fullValues = Array.from({ length: propertyCount }, (_, index) => index + 1);

            assert.equal(source.calcNeededBufferSize(true), maskByteLength + propertyCount);
            const fullBytes = encode(source, true);
            assert.deepEqual(Array.from(fullBytes), [
                ...maskBytes(Math.pow(2, propertyCount) - 1, maskByteLength),
                ...fullValues,
            ]);

            const fullView = new DataView(fullBytes.buffer);
            assert.equal(target.preflightDeserialize(fullView, 0, true), fullBytes.byteLength);
            assert.equal(target.deserialize(fullView, 0), fullBytes.byteLength);
            assert.deepEqual(target.values(), fullValues);

            source.setValue(propertyCount - 1, 200);
            assert.equal(source.calcNeededBufferSize(false), maskByteLength + 1);
            const deltaBytes = encode(source);
            assert.deepEqual(Array.from(deltaBytes), [
                ...maskBytes(Math.pow(2, propertyCount - 1), maskByteLength),
                200,
            ]);

            const deltaView = new DataView(deltaBytes.buffer);
            assert.equal(target.preflightDeserialize(deltaView, 0), deltaBytes.byteLength);
            assert.equal(target.deserialize(deltaView, 0), deltaBytes.byteLength);
            assert.deepEqual(target.values(), [...fullValues.slice(0, -1), 200]);
            assert.equal(source.calcNeededBufferSize(false), 0);
        });
    }
});

test("foundation/serialization: inherited declaration order preserves v1 golden bytes", () => {
    const source = new InheritedPacket();
    const target = new InheritedPacket();
    const fullBytes = encode(source, true);

    // Bits follow declaration order: child, base, derived, tail. V1 writes
    // inherited and derived scalars first, then the nested child's own record.
    assert.deepEqual(Array.from(fullBytes), [0x0f, 0x12, 0x34, 0x56, 0x78, 0x9a, 0x01, 0x0b]);
    const fullView = new DataView(fullBytes.buffer);
    assert.equal(target.preflightDeserialize(fullView, 0, true), 8);
    assert.equal(target.deserialize(fullView, 0), 8);
    assert.equal(target.base, 0x1234);
    assert.equal(target.child.value, 11);
    assert.equal(target.derived, 0x56);
    assert.equal(target.tail, 0x789a);

    source.tail = 0xabcd;
    source.addChange("tail");
    const deltaBytes = encode(source);
    assert.deepEqual(Array.from(deltaBytes), [0x08, 0xab, 0xcd]);
    const deltaView = new DataView(deltaBytes.buffer);
    assert.equal(target.preflightDeserialize(deltaView, 0), 3);
    assert.equal(target.deserialize(deltaView, 0), 3);
    assert.equal(target.tail, 0xabcd);
    assert.equal(target.base, 0x1234);
    assert.equal(target.child.value, 11);
    assert.equal(target.derived, 0x56);
});

test("foundation/serialization: a failed nested full write preserves every complete-update flag", () => {
    const source = new NestedPacket();
    const fullSize = source.calcNeededBufferSize(false);

    // The first child fits, but the second child's value is outside this view.
    assert.throws(() => source.serialize(new DataView(new ArrayBuffer(fullSize - 1)), 0), RangeError);
    assert.equal(source.calcNeededBufferSize(false), fullSize);
    assert.deepEqual(Array.from(encode(source)), [3, 1, 11, 1, 22]);
    assert.equal(source.calcNeededBufferSize(false), 0);
});

test("foundation/serialization: a failed nested delta write preserves earlier dirty fields", () => {
    const source = new NestedPacket();
    encode(source);
    source.first.value = 31;
    source.first.addChange("value");
    source.second.value = 32;
    source.second.addChange("value");
    const deltaSize = source.calcNeededBufferSize(false);

    assert.throws(() => source.serialize(new DataView(new ArrayBuffer(deltaSize - 1)), 0), RangeError);
    assert.equal(source.first.hasChange("value"), true);
    assert.equal(source.second.hasChange("value"), true);
    assert.equal(source.calcNeededBufferSize(false), deltaSize);
    assert.deepEqual(Array.from(encode(source)), [3, 1, 31, 1, 32]);
    assert.equal(source.first.hasChange("value"), false);
    assert.equal(source.second.hasChange("value"), false);
    assert.equal(source.calcNeededBufferSize(false), 0);
});

test("foundation/serialization: a successful preserving write requires an explicit commit", () => {
    const source = new NestedPacket();
    const fullSize = source.calcNeededBufferSize(false);
    const view = new DataView(new ArrayBuffer(fullSize));

    assert.equal(source.serializePreservingChanges(view, 0), fullSize);
    assert.deepEqual(Array.from(new Uint8Array(view.buffer)), [3, 1, 11, 1, 22]);
    assert.equal(source.calcNeededBufferSize(false), fullSize);

    source.commitSerializedChanges();
    assert.equal(source.calcNeededBufferSize(false), 0);
});
