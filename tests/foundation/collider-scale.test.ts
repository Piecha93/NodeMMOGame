import assert from "node:assert/strict";
import { test } from "node:test";
import { Circle } from "detect-collisions";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Transform } from "../../shared/game_utils/physics/Transform";

test("collider scale follows transform changes while retaining the player's double-sized trigger", () => {
    const player = new Player(new Transform([100, 100], [32, 32]));
    const [body, trigger] = player.Colliders;
    assert.ok(body);
    assert.ok(trigger);
    assert.equal(trigger.Body.collides(new Circle(160, 100, 1)), false);

    player.Transform.ScaleX = 64;
    player.Transform.ScaleY = 16;
    player.updateColliders();
    assert.equal(body.Body.collides(new Circle(130, 100, 1)), true);
    assert.equal(body.Body.collides(new Circle(145, 100, 1)), false);
    assert.equal(trigger.Body.collides(new Circle(160, 100, 1)), true);
    assert.equal(body.Body.collides(new Circle(100, 112, 1)), false);
    assert.equal(trigger.Body.collides(new Circle(100, 112, 1)), true);
});

test("circular collider retains its radius-to-transform ratio on resize", () => {
    const object = new GameObject(new Transform([100, 100], [10, 10]));
    const collider = object.addCollider(5);
    object.Transform.ScaleX = 20;
    object.Transform.ScaleY = 30;
    object.updateColliders();
    const body = collider.Body;
    assert.ok(body instanceof Circle);
    assert.equal(body.radius, 10);
    object.updateColliders();
    assert.equal(body.radius, 10);
});
