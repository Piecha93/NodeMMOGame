import assert from "node:assert/strict";
import { test } from "node:test";

import { SerializableProperty } from "../../shared/serialize/SerializeDecorators";
import { Serializable, SerializableTypes } from "../../shared/serialize/Serializable";

class StringPacket extends Serializable {
    @SerializableProperty("value", SerializableTypes.String)
    public value: string;

    constructor(value: string = "") {
        super();
        this.value = value;
    }
}

class PrefixedStringPacket extends Serializable {
    @SerializableProperty("prefix", SerializableTypes.Uint8)
    public prefix = 42;

    @SerializableProperty("value", SerializableTypes.String)
    public value: string;

    constructor(value: string) {
        super();
        this.value = value;
    }
}

function roundTrip(value: string): string {
    const source = new StringPacket(value);
    const buffer = new ArrayBuffer(source.calcNeededBufferSize(true));
    const view = new DataView(buffer);

    assert.equal(source.serialize(view, 0, true), buffer.byteLength);

    const target = new StringPacket();
    assert.equal(target.deserialize(view, 0), buffer.byteLength);
    return target.value;
}

test("foundation/serialization: legacy string fields preserve ASCII", () => {
    assert.equal(roundTrip("Node MMO 123!"), "Node MMO 123!");
});

test("foundation/serialization: v1 strings preserve the empty and 255-code-unit boundaries", () => {
    for (const value of ["", "x".repeat(255)]) {
        const source = new StringPacket(value);
        const buffer = new ArrayBuffer(source.calcNeededBufferSize(true));
        const view = new DataView(buffer);

        assert.equal(source.serialize(view, 0, true), value.length + 2);
        assert.deepEqual(Array.from(new Uint8Array(buffer)), [
            1,
            value.length,
            ...Array.from(value, (character) => character.charCodeAt(0)),
        ]);
        assert.equal(new StringPacket().preflightDeserialize(view, 0, true), buffer.byteLength);
        assert.equal(roundTrip(value), value);
    }
});

test("foundation/serialization: v1 rejects a 256-code-unit string before sizing or writing", () => {
    const source = new PrefixedStringPacket("x".repeat(256));
    assert.throws(() => source.calcNeededBufferSize(true), { name: "RangeError", message: /255/ });

    for (const write of ["serialize", "serializePreservingChanges"] as const) {
        const bytes = new Uint8Array(300).fill(0xa5);
        assert.throws(() => source[write](new DataView(bytes.buffer), 0, true), {
            name: "RangeError",
            message: /255/,
        });
        assert.deepEqual(bytes, new Uint8Array(300).fill(0xa5));
    }

    source.value = "ok";
    assert.equal(source.calcNeededBufferSize(false), 5);
    const buffer = new ArrayBuffer(5);
    assert.equal(source.serialize(new DataView(buffer), 0), 5);
    assert.deepEqual(Array.from(new Uint8Array(buffer)), [3, 42, 2, 111, 107]);
    assert.equal(source.calcNeededBufferSize(false), 0);
});

test("foundation/serialization: legacy v1 retains the low byte of each UTF-16 code unit", () => {
    const source = new StringPacket("Ł");
    const buffer = new ArrayBuffer(source.calcNeededBufferSize(true));

    assert.equal(source.serialize(new DataView(buffer), 0, true), 3);
    assert.deepEqual(Array.from(new Uint8Array(buffer)), [1, 1, 0x41]);
    assert.equal(roundTrip("Ł"), "A");
});
