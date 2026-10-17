import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, Text } from "pixi.js";
import { ExpeditionMarkers } from "../../client/graphic/ExpeditionMarkers";
import { ExpeditionState } from "../../shared/gameplay/Expedition";

function state(overrides: Partial<ExpeditionState> = {}): ExpeditionState {
    return {
        round: 1,
        phase: "active",
        remainingMs: 480_000,
        collected: 0,
        total: 6,
        kills: 0,
        wave: 0,
        waveStage: "preparing",
        enemiesRemaining: 0,
        stageRemainingMs: 15_000,
        home: { x: 640, y: 640, radius: 110 },
        camps: [],
        party: [],
        ...overrides,
    };
}

test("village markers: one campfire replaces quest markers and stable updates reuse display objects", () => {
    const markers = new ExpeditionMarkers();
    markers.setState(state());
    assert.equal(markers.children.length, 1);
    const camp = markers.children[0] as Container;
    assert.deepEqual([camp.x, camp.y], [640, 640]);
    const label = camp.children.find((child) => child instanceof Text) as Text;
    assert.equal(label.text, "OGNISKO · CHWILA ODDECHU");
    markers.setState(state({ stageRemainingMs: 10_000 }));
    assert.equal(markers.children[0], camp, "countdown snapshots must not rebuild Pixi graphics or labels");
    markers.setState(state({ waveStage: "combat", wave: 1, enemiesRemaining: 4, stageRemainingMs: 0 }));
    assert.equal(camp.destroyed, true);
    const fightingCamp = markers.children[0] as Container;
    assert.equal((fightingCamp.children.find((child) => child instanceof Text) as Text).text, "POLANA");
    markers.setState(state({ waveStage: "combat", wave: 1, enemiesRemaining: 3, stageRemainingMs: 0, kills: 1 }));
    assert.equal(markers.children[0], fightingCamp);
    markers.destroy({ children: true });
    assert.equal(fightingCamp.destroyed, true);
});
