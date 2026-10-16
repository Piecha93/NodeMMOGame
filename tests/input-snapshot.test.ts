import { strict as assert } from "node:assert";
import { test } from "node:test";

import { INPUT_COMMAND } from "../shared/input/InputCommands";
import { InputSnapshot, InvalidInputSnapshotError } from "../shared/input/InputSnapshot";

test("input snapshot keeps the existing wire format for valid commands", () => {
    const snapshot: InputSnapshot = new InputSnapshot();
    snapshot.append(INPUT_COMMAND.HORIZONTAL, -1);
    snapshot.append(INPUT_COMMAND.VERTICAL, 0);
    snapshot.append(INPUT_COMMAND.LEFT_MOUSE, "12.5,-3");
    snapshot.append(INPUT_COMMAND.INTERACT, "A42");
    snapshot.append(INPUT_COMMAND.SWITCH_WEAPON, null);

    const parsed: InputSnapshot = new InputSnapshot(snapshot.serializeSnapshot());

    assert.equal(parsed.ID, snapshot.ID);
    assert.equal(parsed.Commands.get(INPUT_COMMAND.HORIZONTAL), "-1");
    assert.equal(parsed.Commands.get(INPUT_COMMAND.VERTICAL), "0");
    assert.equal(parsed.Commands.get(INPUT_COMMAND.LEFT_MOUSE), "12.5,-3");
    assert.equal(parsed.Commands.get(INPUT_COMMAND.INTERACT), "A42");
    assert.equal(parsed.Commands.get(INPUT_COMMAND.SWITCH_WEAPON), "null");
});

test("input snapshot rejects malformed, empty and unknown commands", () => {
    const malformedSnapshots: string[] = [
        "",
        "   ",
        "malformed",
        "0=",
        "=2:0",
        "-1=2:0",
        "1.5=2:0",
        "0=2",
        "0=:0",
        "0=2:0#",
        "0=2:0:1",
        "0=999:0",
        "0=2:0#2:1",
        `${Number.MAX_SAFE_INTEGER}0=2:0`,
    ];

    malformedSnapshots.forEach((serializedSnapshot: string) => {
        assert.throws(() => new InputSnapshot(serializedSnapshot), InvalidInputSnapshotError, serializedSnapshot);
    });
});

test("input snapshot rejects oversized payloads and values", () => {
    const oversizedSnapshot: string = `0=9:${"A".repeat(InputSnapshot.MAX_SERIALIZED_LENGTH)}`;

    assert.throws(() => new InputSnapshot(oversizedSnapshot), InvalidInputSnapshotError);
    assert.throws(() => new InputSnapshot(`0=9:A${"1".repeat(128)}`), InvalidInputSnapshotError);
});

test("input snapshot rejects non-finite and out-of-range numeric values", () => {
    const invalidNumericSnapshots: string[] = [
        "0=2:NaN",
        "0=2:Infinity",
        "0=2:-Infinity",
        "0=2:1.1",
        "0=5:-1.1",
        "0=6:NaN,0",
        "0=7:0,Infinity",
        "0=8:0,-Infinity",
        "0=9:NaN",
        "0=9:Infinity",
        "0=11:1000001,0",
    ];

    invalidNumericSnapshots.forEach((serializedSnapshot: string) => {
        assert.throws(() => new InputSnapshot(serializedSnapshot), InvalidInputSnapshotError, serializedSnapshot);
    });
});

test("failed deserialization does not partially replace a valid snapshot", () => {
    const snapshot: InputSnapshot = new InputSnapshot("7=2:1#5:0");

    assert.throws(() => snapshot.deserialize("8=2:0#999:1"), InvalidInputSnapshotError);

    assert.equal(snapshot.ID, 7);
    assert.deepEqual(Array.from(snapshot.Commands.entries()), [
        [INPUT_COMMAND.HORIZONTAL, "1"],
        [INPUT_COMMAND.VERTICAL, "0"],
    ]);
});
