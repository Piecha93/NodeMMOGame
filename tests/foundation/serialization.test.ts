import assert from "node:assert/strict";
import {test} from "node:test";

import {SerializableProperty} from "../../shared/serialize/SerializeDecorators";
import {Serializable, SerializableTypes} from "../../shared/serialize/Serializable";

class StringPacket extends Serializable {
    @SerializableProperty("value", SerializableTypes.String)
    public value: string;

    constructor(value: string = "") {
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

test.skip("foundation/serialization: protocol v1 must preserve UTF-8", () => {
    // The checked-in browser bundle uses the legacy one-byte-per-code-unit format.
    // Enable this regression test only together with a versioned protocol migration.
    assert.equal(roundTrip("Zażółć gęślą jaźń 🎮"), "Zażółć gęślą jaźń 🎮");
});
