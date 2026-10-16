import assert from "node:assert/strict";
import test from "node:test";
import { EXPEDITION, ExpeditionState, isExpeditionState } from "../../shared/gameplay/Expedition";

const state = (): ExpeditionState => ({
    round: 1,
    phase: "active",
    remainingMs: EXPEDITION.durationMs,
    collected: 0,
    total: 3,
    kills: 0,
    home: EXPEDITION.home,
    camps: EXPEDITION.camps.map((camp) => ({ ...camp, status: "guarded", guardsRemaining: 2 })),
    party: [{ id: "A1", name: "Wędrowiec", hp: 175, maxHp: 200, respawnInMs: 0 }],
});

test("expedition state: validates the whole bounded HUD message without coercion", () => {
    assert.equal(isExpeditionState(state()), true);
    for (const invalid of [
        null,
        [],
        {},
        { ...state(), phase: ["active"] },
        { ...state(), collected: 1.5 },
        { ...state(), remainingMs: Infinity },
        { ...state(), party: Array(5).fill(state().party[0]) },
        { ...state(), party: [{ ...state().party[0], hp: 201 }] },
        { ...state(), camps: Array(3).fill(state().camps[0]) },
        { ...state(), camps: state().camps.map((camp) => ({ ...camp, status: ["guarded"] })) },
    ]) {
        assert.equal(isExpeditionState(invalid), false);
    }
});
