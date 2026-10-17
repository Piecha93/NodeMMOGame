import assert from "node:assert/strict";
import { test } from "node:test";
import { VillageMapController } from "../../server/runtime/VillageMapController";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { isVillageWalkable, villageTileAt, VILLAGE_OBSTACLES, VILLAGE_PROPS } from "../../shared/gameplay/VillageMap";

test("village terrain: deterministic global tiles select grass variants and continuous neighbour-aware shores", () => {
    const variants = new Set<number>();
    for (let y = -4; y < 48; y++) {
        for (let x = -4; x < 48; x++) {
            const tile = villageTileAt(x, y);
            assert.deepEqual(tile, villageTileAt(x, y));
            if (tile.kind === "grass") variants.add(tile.variant);
            if (tile.kind !== "water") continue;
            for (const [dx, dy, mask] of [
                [0, -1, 1],
                [1, 0, 2],
                [0, 1, 4],
                [-1, 0, 8],
            ]) {
                assert.equal(Boolean(tile.shore & mask), villageTileAt(x + dx, y + dy).kind !== "water");
            }
        }
    }
    assert.equal(variants.size, 4);
    assert.equal(villageTileAt(34, 40).kind, "water", "stream crosses the 1280px chunk boundary");
    assert.equal(villageTileAt(34, 39).shore & 4, 0, "a chunk seam must never create a false bank");
});

test("village terrain: merged water collision covers every water tile and leaves the entire bridge passable", () => {
    for (let y = 4; y < 44; y++) {
        for (let x = 4; x < 44; x++) {
            const tile = villageTileAt(x, y);
            if (tile.kind === "water") assert.equal(isVillageWalkable(x * 32 + 16, y * 32 + 16, 0), false);
            if (tile.kind === "bridge") assert.equal(isVillageWalkable(x * 32 + 16, y * 32 + 16, 15), true);
        }
    }
    assert.ok(VILLAGE_OBSTACLES.length < 32, "water must merge into a handful of physics bodies");
    for (const args of [
        [NaN, 640, 16],
        [640, Infinity, 16],
        [640, 640, -1],
    ]) {
        assert.equal(isVillageWalkable(args[0], args[1], args[2]), false);
    }
    assert.equal(isVillageWalkable(1088 - 16, 400, 16), true, "touching a bank matches the physics AABB boundary");
    assert.equal(isVillageWalkable(1088 - 15, 400, 16), false);
});

test("village terrain: broad paths connect the spawn, every cottage approach, bridge, and all four exits", () => {
    const queue: [number, number][] = [[20, 20]];
    const visited = new Set<string>(["20,20"]);
    for (let index = 0; index < queue.length; index++) {
        const [x, y] = queue[index];
        for (const [dx, dy] of [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
        ]) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;
            if (
                nx < 4 ||
                nx >= 44 ||
                ny < 4 ||
                ny >= 44 ||
                visited.has(key) ||
                !isVillageWalkable(nx * 32 + 16, ny * 32 + 16, 16)
            )
                continue;
            visited.add(key);
            queue.push([nx, ny]);
        }
    }
    for (const [x, y] of [
        [20, 4],
        [4, 20],
        [43, 20],
        [20, 43],
        [11, 14],
        [30, 14],
        [13, 31],
        [35, 20],
        [25, 28],
    ]) {
        assert.ok(visited.has(`${x},${y}`), `Village approach ${x},${y} must be reachable`);
    }
    assert.equal(VILLAGE_PROPS.filter((entry) => entry.kind.startsWith("house_")).length, 3);
});

test("village terrain: static cover survives chunk sleep, starts once, and cleans serialized copies on dispose", (t) => {
    const core = new GameCore({ role: Origin.SERVER, cooperative: true });
    t.after(() => core.dispose());
    const village = new VillageMapController(core);
    village.start();
    village.start();
    const ids = Array.from(core.ObjectsManager.ObjectsById.keys()).sort();
    assert.equal(ids.length, VILLAGE_OBSTACLES.length);
    for (const object of core.ObjectsManager.ObjectsById.values()) {
        assert.equal(object.SpriteName, "none");
        assert.equal(object.IsSolid, true);
        assert.equal(object.IsChunkDeactivationPersistent, true);
    }
    for (const chunk of core.ChunksManager.ChunksIterator()) chunk.deactivate();
    assert.equal(core.ObjectsManager.ObjectsById.size, 0);
    for (const chunk of core.ChunksManager.ChunksIterator()) chunk.activate();
    assert.deepEqual(Array.from(core.ObjectsManager.ObjectsById.keys()).sort(), ids);
    for (const chunk of core.ChunksManager.ChunksIterator()) chunk.deactivate();
    village.dispose();
    village.dispose();
    for (const chunk of core.ChunksManager.ChunksIterator()) chunk.activate();
    assert.equal(core.ObjectsManager.ObjectsById.size, 0, "sleeping cover must not return after disposal");
    assert.throws(() => village.start(), /disposed/);
});

test("village terrain: performance and client worlds never instantiate authoritative village cover", (t) => {
    for (const options of [{ role: Origin.CLIENT }, { role: Origin.SERVER, performanceMode: true }]) {
        const core = new GameCore(options);
        t.after(() => core.dispose());
        assert.throws(() => new VillageMapController(core), /normal server world/);
        assert.equal(core.ObjectsManager.ObjectsById.size, 0);
    }
});
