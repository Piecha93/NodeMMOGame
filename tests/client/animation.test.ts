import assert from "node:assert/strict";
import { test } from "node:test";
import { Text, Texture } from "pixi.js";
import { ActorFeedback, AnimationClock, presentationPhase } from "../../client/graphic/AnimationClock";
import { GameObjectAnimationRender } from "../../client/graphic/GameObjectAnimationRender";
import { PlayerRender } from "../../client/graphic/PlayerRender";
import { presentationKind } from "../../client/graphic/Presentation";
import { ResourcesLoader, ResourceType } from "../../client/graphic/ResourcesLoader";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Transform } from "../../shared/game_utils/physics/Transform";

class AnimationProbe extends GameObjectAnimationRender {
    get frame(): number {
        return this.animation?.currentFrame ?? -1;
    }

    get autoUpdate(): boolean {
        return this.animation?.autoUpdate ?? true;
    }
}

function animationResource(name: string, directional = false): void {
    const loader = ResourcesLoader.Instance;
    loader.registerResource(
        name,
        `/resources/test/${name}.json`,
        directional ? ResourceType.OCTAGONAL_ANIMATION : ResourceType.ANIMATION,
    );
    const resource = loader.getResource(name);
    for (const frames of resource.textures.values()) frames.push(...Array<Texture>(8).fill(Texture.EMPTY));
}

test("animation: owning render loop controls sprite frames equally at 30, 60 and 144 FPS", () => {
    animationResource("animation-test");
    const results = [30, 60, 144].map((fps) => {
        const object = new GameObject(new Transform([100, 50]));
        object.SpriteName = "animation-test";
        const render = new AnimationProbe();
        render.setObject(object);
        assert.equal(render.autoUpdate, false, "global Pixi ticker must not also advance the animation");
        for (let frame = 0; frame < fps; frame++) render.update(1000 / fps);
        const result = render.frame;
        render.destroy();
        return result;
    });
    assert.deepEqual(results, [4, 4, 4]);
});

test("animation: invalid deltas and paused frames do not change presentation time", () => {
    const clock = new AnimationClock();
    clock.advance(250);
    for (const delta of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) clock.advance(delta);
    assert.equal(clock.elapsedMs, 250);
    assert.equal(clock.frame(8, 12), 3);
    clock.reset();
    assert.equal(clock.frame(8, 12), 0);
    assert.equal(presentationPhase("A1"), presentationPhase("A1"));
    assert.notEqual(presentationPhase("A1"), presentationPhase("A2"));
});

test("animation: damage feedback expires and health trail settles independently of refresh rate", () => {
    const halfway = [30, 60, 144].map((fps) => {
        const feedback = new ActorFeedback(100, 100);
        feedback.update(50, 100, 0);
        let remainingMs = 300;
        while (remainingMs > 1e-9) {
            const delta = Math.min(1000 / fps, remainingMs);
            feedback.update(50, 100, delta);
            remainingMs -= delta;
        }
        return feedback.trail;
    });
    const expectedTrail = 0.5 + 0.5 * Math.exp(-180 / 110);
    for (const trail of halfway) assert.ok(Math.abs(trail - expectedTrail) < 1e-12);
    const results = [30, 60, 144].map((fps) => {
        const feedback = new ActorFeedback(100, 100);
        feedback.update(50, 100, 0);
        assert.equal(feedback.hit, 1);
        assert.equal(feedback.trail, 1);
        for (let frame = 0; frame < fps; frame++) feedback.update(50, 100, 1000 / fps);
        return [feedback.hit, feedback.trail];
    });
    assert.deepEqual(results, [
        [0, 0.5],
        [0, 0.5],
        [0, 0.5],
    ]);
    const healing = new ActorFeedback(50, 100);
    healing.update(100, 100, 0);
    assert.equal(healing.hit, 0);
    assert.equal(healing.trail, 1);
});

test("animation: unnamed performance enemies allocate no text and visual feedback leaves authority unchanged", () => {
    animationResource("actor-test_idle", true);
    animationResource("actor-test_run", true);
    const enemy = new Enemy(new Transform([100, 50]));
    enemy.SpriteName = "actor-test";
    enemy.Name = "";
    const render = new PlayerRender();
    render.setObject(enemy);
    assert.equal(
        render.children.some((child) => child instanceof Text),
        false,
    );
    enemy.hit(25);
    assert.equal(render.children.length, 2, "full-health enemies need only a sprite and a shadow");
    const hp = enemy.HP;
    const position = enemy.Transform.Position;
    render.update(16);
    render.update(200);
    assert.equal(enemy.HP, hp);
    assert.deepEqual(enemy.Transform.Position, position);
    render.destroy();
});

test("animation: only the default fireball presentation receives the comet effect", () => {
    const projectile = new FireBall(new Transform([10, 20]));
    projectile.SpriteName = "flame";
    assert.equal(presentationKind(projectile, ResourceType.ANIMATION), "projectile");
    projectile.SpriteName = "custom-fireball";
    assert.equal(presentationKind(projectile, ResourceType.ANIMATION), "animation");
    const decoration = new GameObject(new Transform([10, 20]));
    decoration.SpriteName = "flame";
    assert.equal(presentationKind(decoration, ResourceType.ANIMATION), "animation");
});
