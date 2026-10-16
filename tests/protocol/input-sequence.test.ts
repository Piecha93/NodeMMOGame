import assert from "node:assert/strict";
import { test } from "node:test";
import { isNewerSequence, nextSequence, ProtocolError, validateInputCommand, V2_LIMITS } from "../../shared/protocol";

test("protocol/sequence: uint32 rollover preserves serial ordering within a bounded live window", () => {
    assert.equal(nextSequence(0xfffffffe), 0xffffffff);
    assert.equal(nextSequence(0xffffffff), 0);
    assert.equal(isNewerSequence(0, 0xffffffff), true);
    assert.equal(isNewerSequence(1, 0xfffffffe), true);
    assert.equal(isNewerSequence(0xffffffff, 0), false);
    assert.equal(isNewerSequence(4, 4), false);
    assert.equal(isNewerSequence(0x80000000, 0), false);
    assert.equal(isNewerSequence(0, 0x80000000), false);
    for (const invalid of [-1, 0x100000000, NaN, Infinity, 0.5]) {
        assert.throws(() => nextSequence(invalid), ProtocolError);
        assert.throws(() => isNewerSequence(invalid, 0), ProtocolError);
    }
});

test("protocol/input: validation copies bounded gameplay commands without trusting a client duration", () => {
    const source = {
        seq: 0xffffffff,
        horizontal: -1,
        vertical: 0,
        actions: [
            { kind: "primary", x: 100, y: 200 },
            { kind: "secondary", x: -100, y: 1 },
            { kind: "middle", x: 0, y: 0 },
            { kind: "interact", targetId: "C4294967295" },
            { kind: "switchWeapon" },
        ],
    };
    const command = validateInputCommand(source);
    assert.deepEqual(command, source);
    assert.equal(Object.isFrozen(command), true);
    assert.equal(Object.isFrozen(command.actions), true);
    assert.ok(command.actions?.every(Object.isFrozen));
    source.actions[0]!.x = 999;
    assert.equal(command.actions?.[0]?.kind === "primary" ? command.actions[0].x : undefined, 100);
    assert.deepEqual(validateInputCommand({ seq: 0, horizontal: 0, vertical: 1 }), {
        seq: 0,
        horizontal: 0,
        vertical: 1,
    });
    assert.throws(() => validateInputCommand({ ...source, dt: 1_000_000 }), ProtocolError);
});

test("protocol/input: malformed directions, IDs, actions, coordinates and oversized payloads fail cleanly", () => {
    const base = { seq: 1, horizontal: 0, vertical: 0 };
    const cases: unknown[] = [
        null,
        [],
        {},
        { ...base, seq: -1 },
        { ...base, seq: 0x100000000 },
        { ...base, horizontal: 0.5 },
        { ...base, vertical: "1" },
        { ...base, actions: {} },
        { ...base, actions: Array.from({ length: V2_LIMITS.MAX_INPUT_ACTIONS + 1 }, () => ({ kind: "switchWeapon" })) },
        { ...base, actions: [{ kind: "primary", x: Infinity, y: 0 }] },
        { ...base, actions: [{ kind: "primary", x: 1_000_001, y: 0 }] },
        { ...base, actions: [{ kind: "interact", targetId: "C01" }] },
        { ...base, actions: [{ kind: "interact", targetId: "Z1" }] },
        { ...base, actions: [{ kind: "unknown" }] },
        { ...base, actions: [{ kind: "switchWeapon", x: 1 }] },
        { ...base, actions: new Array(1) },
    ];
    for (const candidate of cases) assert.throws(() => validateInputCommand(candidate), ProtocolError);
});
