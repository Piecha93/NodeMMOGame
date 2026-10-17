import assert from "node:assert/strict";
import test from "node:test";
import { EXPEDITION, ExpeditionState, isExpeditionState } from "../../shared/gameplay/Expedition";

const state = (): ExpeditionState => ({
    round: 1,
    phase: "active",
    remainingMs: EXPEDITION.durationMs,
    collected: 0,
    total: 6,
    kills: 0,
    waveStage: "preparing",
    wave: 0,
    enemiesRemaining: 0,
    stageRemainingMs: 15_000,
    home: EXPEDITION.home,
    camps: [],
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
        { ...state(), camps: [{ id: "old-fortress" }] },
        { ...state(), waveStage: ["combat"] },
        { ...state(), wave: 7 },
        { ...state(), collected: 1, wave: 0 },
        { ...state(), enemiesRemaining: 16 },
        { ...state(), stageRemainingMs: 20_001 },
        { ...state(), total: 3 },
    ]) {
        assert.equal(isExpeditionState(invalid), false);
    }
});
