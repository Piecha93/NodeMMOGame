import assert from "node:assert/strict";
import { test } from "node:test";
import { Assets, Texture } from "pixi.js";
import { ResourceType, ResourcesLoader } from "../../client/graphic/ResourcesLoader";

test("resources: repeat registration and concurrent loads share assets without duplicating animation frames", async (t) => {
    const loader = ResourcesLoader.Instance;
    loader.registerResource("lifecycle-animation", "/animation.json", ResourceType.ANIMATION);
    loader.registerResource("lifecycle-animation", "/animation.json", ResourceType.ANIMATION);
    assert.throws(() => loader.registerResource("lifecycle-animation", "/different.json", ResourceType.ANIMATION));
    let loads = 0;
    t.mock.method(Assets, "load", async () => {
        loads++;
        return { textures: { frame1: Texture.EMPTY, frame2: Texture.EMPTY } };
    });
    await Promise.all([loader.load(), loader.load()]);
    await loader.load();
    assert.equal(loads, 1);
    assert.equal(loader.getResource("lifecycle-animation").textures.get("lifecycle-animation")?.length, 2);
});
