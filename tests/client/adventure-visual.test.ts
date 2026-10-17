import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { Container, Graphics, Text, Texture } from "pixi.js";
import { LootRender } from "../../client/graphic/LootRender";
import { PlayerRender } from "../../client/graphic/PlayerRender";
import { ProjectileRender } from "../../client/graphic/ProjectileRender";
import { Renderer } from "../../client/graphic/Renderer";
import { ResourcesLoader, ResourceType } from "../../client/graphic/ResourcesLoader";
import { getAnimationFrameGroup, RESOURCE_MANIFEST } from "../../client/graphic/ResourceManifest";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Transform } from "../../shared/game_utils/physics/Transform";

function repositoryRoot(): string {
    return path.basename(process.cwd()) === "dist-test" ? path.dirname(process.cwd()) : process.cwd();
}

function registerActor(name: string): void {
    const loader = ResourcesLoader.Instance;
    for (const state of ["idle", "run"]) {
        const key = `${name}_${state}`;
        loader.registerResource(key, `/resources/test/${key}.json`, ResourceType.OCTAGONAL_ANIMATION);
        for (const frames of loader.getResource(key).textures.values())
            frames.push(...Array<Texture>(8).fill(Texture.EMPTY));
    }
}

test("adventure visuals: generated RGBA atlases have bounded cells and complete directional animation loops", async () => {
    for (const name of ["wanderer", "wraith"]) {
        const directory = path.join(repositoryRoot(), "public/resources/animations", name);
        const png = await readFile(path.join(directory, "atlas.png"));
        assert.equal(png.subarray(1, 4).toString(), "PNG");
        assert.equal(png[25], 6, "transparent art must keep its RGBA channel");
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);
        for (const state of ["idle", "run"]) {
            const framePrefix = `${name}${state[0].toUpperCase()}${state.slice(1)}`;
            const sheet = JSON.parse(await readFile(path.join(directory, `${state}.json`), "utf8")) as {
                frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
                meta: { image: string; size: { w: number; h: number } };
            };
            assert.deepEqual(sheet.meta.size, { w: width, h: height });
            assert.equal(sheet.meta.image, "atlas.png");
            assert.equal(Object.keys(sheet.frames).length, 64);
            for (const direction of ["U", "UR", "R", "DR", "D", "DL", "L", "UL"]) {
                const columns = new Set<number>();
                for (let index = 0; index < 8; index++) {
                    const frame = sheet.frames[`${framePrefix}_${direction}_${index}`].frame;
                    assert.ok(frame.x >= 0 && frame.y >= 0);
                    assert.ok(frame.x + frame.w <= width && frame.y + frame.h <= height);
                    assert.equal(frame.w, frame.h);
                    columns.add(frame.x);
                }
                assert.equal(columns.size, state === "run" ? 4 : 2);
            }
        }
    }
});

test("adventure visuals: every atlas frame has a globally unique Pixi cache key and retains its animation group", async () => {
    const frames = new Map<string, string>();
    for (const definition of RESOURCE_MANIFEST) {
        if (definition.type === ResourceType.SPRITE) continue;
        const sheet = JSON.parse(
            await readFile(path.join(repositoryRoot(), "public", definition.path.replace(/^\/+/, "")), "utf8"),
        ) as { frames: Record<string, unknown> };
        for (const key of Object.keys(sheet.frames)) {
            assert.equal(
                frames.has(key),
                false,
                `Pixi global texture cache key '${key}' is shared by '${frames.get(key)}' and '${definition.name}'`,
            );
            frames.set(key, definition.name);
            assert.ok(
                getAnimationFrameGroup(definition.type, definition.name, key),
                `${definition.name}/${key} must retain its loader animation group`,
            );
        }
    }
});

test("adventure visuals: pickup animation depends on elapsed time and leaves replicated state untouched", () => {
    for (const sprite of ["loot_xp", "loot_coin", "loot_heal"]) {
        const results = [30, 60, 144].map((fps) => {
            const object = new GameObject(new Transform([45, 67]));
            object.ID = "same-pickup";
            object.SpriteName = sprite;
            const render = new LootRender();
            render.setObject(object);
            for (let frame = 0; frame < fps; frame++) render.update(1000 / fps);
            const body = render.children[2];
            const result = [body.y, body.rotation, render.children[0].scale.x];
            assert.deepEqual(object.Transform.Position, [45, 67]);
            assert.equal(object.SpriteName, sprite);
            render.destroy();
            return result;
        });
        for (const result of results)
            for (let index = 0; index < result.length; index++)
                assert.ok(Math.abs(result[index] - results[0][index]) < 1e-10);
    }
});

test("adventure visuals: held weapon layering settles, recoil expires and body scale does not accumulate", () => {
    registerActor("wanderer");
    const actor = new Enemy(new Transform([10, 20]));
    actor.SpriteName = "wanderer";
    const render = new PlayerRender();
    render.setObject(actor);
    const probe = render as unknown as {
        animation: Container;
        heldWeapon: Container;
        muzzle: Graphics;
    };
    render.aimAt(10, -100);
    render.update(16);
    const order = render.children.slice();
    for (let tick = 0; tick < 20; tick++) render.update(16);
    assert.deepEqual(render.children, order, "aiming up must not swap staff and body on every render frame");
    render.setAdventureWeapon("lance");
    render.fire(0);
    render.update(16);
    assert.equal(probe.muzzle.visible, true);
    render.update(200);
    assert.equal(probe.muzzle.visible, false);
    assert.ok(render.getChildIndex(probe.heldWeapon) > render.getChildIndex(probe.animation));
    const width = probe.animation.width;
    for (let tick = 0; tick < 30; tick++) render.update(16);
    assert.ok(Math.abs(probe.animation.width - width) < 1e-10);
    assert.deepEqual(actor.Transform.Position, [10, 20]);
    assert.deepEqual([actor.Transform.ScaleX, actor.Transform.ScaleY], [32, 32]);
    render.destroy();
});

test("adventure visuals: only ordinary character skins allocate floating damage labels", () => {
    registerActor("wraith");
    registerActor("template");
    for (const skin of ["wraith", "template"]) {
        const actor = new Enemy(new Transform([0, 0]));
        actor.SpriteName = skin;
        const render = new PlayerRender();
        render.setObject(actor);
        actor.hit(25);
        render.update(16);
        const labels = render.children.filter((child) => child instanceof Text);
        assert.equal(labels.length, skin === "wraith" ? 1 : 0);
        if (skin === "wraith") {
            assert.equal((labels[0] as Text).text, "25");
            render.update(700);
            assert.equal(labels[0].visible, false);
        }
        render.destroy();
    }
});

test("adventure visuals: renderer selects vector loot without loading an unknown texture and renders energy shots", () => {
    const renderer = Object.create(Renderer.prototype) as Renderer;
    Object.assign(renderer, {
        renderObjects: new Map(),
        renderObjectsById: new Map(),
        adventureWeapons: new Map(),
        rootContainer: new Container(),
        resourcesLoader: ResourcesLoader.Instance,
    });
    const objects: GameObject[] = [];
    for (const name of ["loot_xp", "loot_coin", "loot_heal"]) {
        const object = new GameObject(new Transform([0, 0]));
        object.ID = name;
        object.SpriteName = name;
        renderer.onObjectCreate(object);
        objects.push(object);
    }
    const loader = ResourcesLoader.Instance;
    for (const name of ["bluebolt", "fireball"]) {
        loader.registerResource(name, `/resources/images/${name}.png`, ResourceType.SPRITE);
        const projectile = new FireBall(new Transform([0, 0]));
        projectile.ID = name;
        projectile.SpriteName = name;
        renderer.onObjectCreate(projectile);
        objects.push(projectile);
    }
    const renders = (renderer as unknown as { renderObjects: Map<GameObject, Container> }).renderObjects;
    for (const object of objects) {
        assert.ok(renders.get(object) instanceof (object instanceof FireBall ? ProjectileRender : LootRender));
        renderer.onObjectDestroy(object);
    }
    assert.equal(renders.size, 0);
});
