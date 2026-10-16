import assert from "node:assert/strict";
import { test } from "node:test";
import { GameObjectRender } from "../../client/graphic/GameObjectRender";
import { Renderer } from "../../client/graphic/Renderer";
import { presentationKind } from "../../client/graphic/Presentation";
import { ResourceType } from "../../client/graphic/ResourceManifest";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Transform } from "../../shared/game_utils/physics/Transform";

class RenderProbe extends GameObjectRender {
    constructor() {
        super();
    }
}
class InvisibleObject extends GameObject {
    constructor() {
        super(new Transform([50, 50]));
        this.invisible = true;
    }
}

test("presentation: equal elapsed time gives equal smoothing at 30, 60 and 144 FPS", () => {
    const object = new GameObject(new Transform([100, 50]));
    const results = [30, 60, 144].map((fps) => {
        const render = new RenderProbe();
        render.setObject(object);
        for (let frame = 0; frame < fps; frame++) render.update(1000 / fps);
        const result = [render.x, render.y];
        render.destroy();
        return result;
    });
    const reference = results[0];
    assert.ok(reference);
    for (const result of results) {
        assert.ok(Math.abs((result[0] ?? 0) - (reference[0] ?? 0)) < 1e-9);
        assert.ok(Math.abs((result[1] ?? 0) - (reference[1] ?? 0)) < 1e-9);
    }
});

test("presentation: remote interpolation bypasses smoothing without moving simulation state", () => {
    const object = new GameObject(new Transform([100, 50]));
    const render = new RenderProbe();
    render.setObject(object);
    render.presentationPosition = [70, 40];
    render.update(1000 / 30);
    assert.equal(render.x, 70);
    assert.equal(render.y, 40);
    assert.deepEqual(object.Transform.Position, [100, 50]);
    render.destroy();
});

test("presentation: camera culling never makes an invisible entity visible", () => {
    const object = new InvisibleObject();
    const render = new RenderProbe();
    render.setObject(object);
    render.update();
    const renderer = Object.create(Renderer.prototype) as {
        renderObjects: Map<GameObject, GameObjectRender>;
        camera: { pivot: { x: number; y: number } };
        map: null;
        hideNotVisibleObjects(): void;
    };
    renderer.renderObjects = new Map([[object, render]]);
    renderer.camera = { pivot: { x: 0, y: 0 } };
    renderer.map = null;
    renderer.hideNotVisibleObjects();
    assert.equal(render.visible, false);
    render.destroy();
});

test("presentation: actor HUD selection depends on domain type, independent of wire ID", () => {
    const player = new Player(new Transform([0, 0]));
    player.ID = "custom-player";
    assert.equal(presentationKind(player, ResourceType.SPRITE), "actor");
    const object = new GameObject(new Transform([0, 0]));
    object.ID = "A999";
    assert.equal(presentationKind(object, ResourceType.SPRITE), "sprite");
    assert.equal(presentationKind(object, ResourceType.ANIMATION), "animation");
});
