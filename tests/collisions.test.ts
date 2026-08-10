import assert from "node:assert/strict";
import test from "node:test";
import {Collision} from "../shared/game_utils/physics/Collision";
import {CollisionsSystem} from "../shared/game_utils/physics/CollisionsSystem";
import {GameObject} from "../shared/game_utils/game/objects/GameObject";
import {Transform} from "../shared/game_utils/physics/Transform";

class CollisionProbe extends GameObject {
    public enters: number = 0;
    public exits: number = 0;
    public lastExit?: Collision;

    constructor(x: number, y: number) {
        super(new Transform([x, y], 10));
    }

    protected sharedOnCollisionEnter(_collision: Collision) {
        this.enters++;
    }

    protected sharedOnCollisionExit(collision: Collision) {
        this.exits++;
        this.lastExit = collision;
    }
}

test("collision exit reports the pair that stopped colliding", () => {
    const system = new CollisionsSystem();
    const first = new CollisionProbe(0, 0);
    const second = new CollisionProbe(5, 0);

    system.insertObject(first);
    system.insertObject(second);
    system.update();
    system.updateCollisionsForGameObject(first);

    assert.equal(first.enters, 1);

    second.Transform.X = 100;
    second.updateColliders();
    system.update();
    system.updateCollisionsForGameObject(first);

    assert.equal(first.exits, 1);
    assert.ok(first.lastExit);
    assert.equal(first.lastExit.Result.collision, false);
    assert.equal(first.lastExit.Result.a, first.Colliders[0].Body);
    assert.equal(first.lastExit.Result.b, second.Colliders[0].Body);
    assert.equal(first.lastExit.Result.overlap, 0);
});

test("polygon colliders follow transform rotation", () => {
    const object = new CollisionProbe(0, 0);

    object.Transform.Rotation = Math.PI / 3;
    object.updateColliders();

    assert.equal(object.Colliders[0].Rotation, Math.PI / 3);
});
