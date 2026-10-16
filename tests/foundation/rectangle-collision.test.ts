import assert from "node:assert/strict";
import test from "node:test";
import { Polygon, Result } from "detect-collisions";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Transform } from "../../shared/game_utils/physics/Transform";

function compare(first: GameObject, second: GameObject): void {
    const a = first.Colliders[0];
    const b = second.Colliders[0];
    const expected = new Result();
    const actual = new Result();
    const expectedCollision = a.Body.collides(b.Body, expected);
    assert.equal(a.collides(b, actual), expectedCollision);
    assert.equal(a.collides(b), expectedCollision);
    for (const property of ["a", "b", "collision", "a_in_b", "b_in_a", "overlap", "overlap_x", "overlap_y"] as const) {
        assert.equal(actual[property], expected[property], property);
    }
}

test("rectangle narrowphase matches SAT for overlap, containment, touching edges and offset colliders", () => {
    let state = 0x91a24;
    const random = (range: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % range;
    };
    const first = new GameObject(new Transform([0, 0], [10, 10]));
    const second = new GameObject(new Transform([0, 0], [10, 10]));
    for (let index = 0; index < 6000; index++) {
        first.Transform.X = random(80) - 40;
        first.Transform.Y = random(80) - 40;
        second.Transform.X = random(80) - 40;
        second.Transform.Y = random(80) - 40;
        first.Transform.ScaleX = random(80) + 1;
        first.Transform.ScaleY = random(80) + 1;
        second.Transform.ScaleX = random(80) + 1;
        second.Transform.ScaleY = random(80) + 1;
        first.Colliders[0].OffsetX = random(10) - 5;
        second.Colliders[0].OffsetY = random(10) - 5;
        first.updateColliders();
        second.updateColliders();
        compare(first, second);
        compare(second, first);
    }
    for (const [x, y] of [
        [0, 0],
        [10, 0],
        [-10, 0],
        [0, 10],
        [0, -10],
        [5, 5],
        [-5, -5],
    ]) {
        const a = new GameObject(new Transform([0, 0], [10, 10]));
        const b = new GameObject(new Transform([x, y], [10, 10]));
        compare(a, b);
        compare(b, a);
    }
});

test("rectangle narrowphase retains SAT for rotation, mirrored polygons and circles", () => {
    const rectangle = new GameObject(new Transform([0, 0], [16, 24]));
    const other = new GameObject(new Transform([8, 4], [20, 12]));
    for (const rotation of [Math.PI / 5, Math.PI / 2, Math.PI, Math.PI * 2]) {
        rectangle.Transform.Rotation = rotation;
        rectangle.updateColliders();
        compare(rectangle, other);
        compare(other, rectangle);
    }
    rectangle.Transform.Rotation = 0;
    rectangle.updateColliders();
    (rectangle.Colliders[0].Body as Polygon).scale_x = -1;
    compare(rectangle, other);
    compare(other, rectangle);
    const circle = new GameObject(new Transform([4, 3], 16));
    circle.Colliders.splice(0, 1);
    circle.addCollider(16);
    compare(circle, other);
    compare(other, circle);
});

test("public polygon edits leave the rectangle fast path until the collider is resized", () => {
    const first = new GameObject(new Transform([0, 0], [16, 16]));
    const second = new GameObject(new Transform([6, 6], [8, 8]));
    const body = first.Colliders[0].Body as Polygon & { setPoints(points: number[][]): void };
    body.setPoints([
        [-8, -8],
        [8, -8],
        [-8, 8],
    ]);
    compare(first, second);
    compare(second, first);
    first.Transform.ScaleX = 20;
    first.updateColliders();
    compare(first, second);
    compare(second, first);
});
