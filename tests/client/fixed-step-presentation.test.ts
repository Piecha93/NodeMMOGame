import assert from "node:assert/strict";
import { test } from "node:test";
import { FixedStepPresentation } from "../../client/graphic/FixedStepPresentation";
import { Origin } from "../../shared/core/Origin";
import { GameCore } from "../../shared/GameCore";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { InputSnapshot } from "../../shared/input/InputSnapshot";

test("local presentation: real fixed simulation draws the same continuous movement and stop at 30, 60 and 144 FPS", () => {
    for (const fps of [30, 60, 144]) {
        const core = new GameCore({ role: Origin.CLIENT });
        try {
            const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
            const presentation = new FixedStepPresentation();
            presentation.reset(player.Transform.Position);
            core.subscribeBeforeStep((tick) =>
                player.setInput(new InputSnapshot(`${tick}=2:0#5:${tick < 32 ? 1 : 0}`)),
            );
            core.subscribeAfterStep(() => presentation.capture(player.Transform.Position));
            let lastX = 100;
            for (let frame = 1; frame <= fps; frame++) {
                const elapsed = (frame * 1000) / fps;
                core.advance(1000 / fps);
                const position = presentation.position(core.SimulationAlpha);
                assert.ok(position);
                const expected = 100 + Math.min(500, Math.max(0, elapsed - 1000 / 64)) * player.Velocity;
                assert.ok(
                    Math.abs(position[0] - expected) < 1e-8,
                    `${fps} FPS frame ${frame}: smooth fixed-tick position`,
                );
                assert.ok(position[0] >= lastX - 1e-9, "stop must not jitter backwards or continue drifting");
                assert.equal(position[1], 100);
                lastX = position[0];
            }
            assert.equal(lastX, 225);
        } finally {
            core.dispose();
        }
    }
});

test("local presentation: reconciliation translates both samples while respawns and teleports snap", () => {
    const presentation = new FixedStepPresentation();
    presentation.reset([100, 100]);
    presentation.capture([104, 100]);
    assert.deepEqual(presentation.position(0.5), [102, 100]);
    presentation.reconcile([106, 100]);
    assert.deepEqual(presentation.position(0.5), [104, 100]);
    presentation.reconcile([700, 600]);
    assert.deepEqual(presentation.position(0), [700, 600]);
    assert.deepEqual(presentation.position(0.5), [700, 600]);
    presentation.capture([704, 600]);
    presentation.reconcile([730, 600], true);
    assert.deepEqual(presentation.position(0), [730, 600], "even a nearby respawn has no interpolated return path");
    presentation.capture([50, 50]);
    assert.deepEqual(presentation.position(0.5), [50, 50], "a simulation teleport also snaps without a network update");
});
