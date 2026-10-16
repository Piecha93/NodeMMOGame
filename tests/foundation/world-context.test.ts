import { legacyView } from "../../shared/replication/LegacyView";
import assert from "node:assert/strict";
import test from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/SharedConfig";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { InputSnapshot } from "../../shared/input/InputSnapshot";

test("world context: differently configured client and server are independent", () => {
    const server = new GameCore({ role: Origin.SERVER, chunkSize: 500, numOfChunksX: 2, numOfChunksY: 3 });
    const client = new GameCore({ role: Origin.CLIENT, chunkSize: 1000, numOfChunksX: 3, numOfChunksY: 2 });
    try {
        const authority = server.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        const replica = client.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        assert.equal(authority.Runtime.isServer, true);
        assert.equal(replica.Runtime.isClient, true);
        assert.notEqual(server.ObjectsFactory.Catalog, client.ObjectsFactory.Catalog);
        assert.deepEqual(
            server.ChunksManager.Chunks.map((column) => column.length),
            [3, 3],
        );
        assert.deepEqual(
            client.ChunksManager.Chunks.map((column) => column.length),
            [2, 2, 2],
        );
        authority.commitReplicationChanges();
        replica.commitReplicationChanges();
        authority.Velocity = 2;
        replica.Velocity = 2;
        assert.ok(legacyView(authority).calcNeededBufferSize(false) > 0);
        assert.equal(legacyView(replica).calcNeededBufferSize(false), 0);
    } finally {
        server.dispose();
        client.dispose();
    }
});

test("world simulation: identical command ticks agree at 30, 60 and 144 render FPS", () => {
    const positions = [30, 60, 144].map((fps) => {
        const core = new GameCore({ role: Origin.SERVER, clock: () => 0 });
        try {
            const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
            core.subscribeBeforeStep((tick) =>
                player.setInput(new InputSnapshot(`${tick}=2:0#5:${tick < 32 ? 1 : 0}`)),
            );
            for (let frame = 0; frame < fps; frame++) core.advance(1000 / fps);
            assert.equal(core.Runtime.tick, 64);
            return player.Transform.Position;
        } finally {
            core.dispose();
        }
    });
    assert.deepEqual(positions, [
        [225, 100],
        [225, 100],
        [225, 100],
    ]);
});

test("world simulation: catch-up is bounded and reports discarded backlog", () => {
    const core = new GameCore({ fixedDeltaMs: 10, maxCatchUpSteps: 3 });
    try {
        assert.equal(core.advance(100), 3);
        assert.equal(core.Runtime.timeMs, 30);
        assert.equal(core.droppedTimeMs, 70);
        assert.throws(() => core.advance(NaN), RangeError);
        assert.throws(() => core.step(-1), RangeError);
    } finally {
        core.dispose();
    }
});

test("world simulation: chunk expiry follows simulation time even when the wall clock is frozen", () => {
    const core = new GameCore({ role: Origin.SERVER, clock: () => 0, fixedDeltaMs: 10, chunkDeactivationTime: 20 });
    try {
        const chunk = core.ChunksManager.Chunks[0][0];
        assert.equal(chunk.IsActive, true);
        for (let tick = 0; tick < 4; tick++) core.step();
        assert.equal(core.Runtime.timeMs, 40);
        assert.equal(chunk.IsActive, false);
    } finally {
        core.dispose();
    }
});

test("world simulation: collision corrections publish final collider geometry before returning", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        core.ObjectsFactory.instantiateWithPosition("Wall", [100, 100]);
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [200, 100]);
        player.Transform.X = 130;
        core.step();
        assert.equal(player.Transform.X, 132);
        for (const collider of player.Colliders) {
            assert.equal(collider.Body.x, player.Transform.X);
            assert.equal(collider.Body.y, player.Transform.Y);
        }
    } finally {
        core.dispose();
    }
});

test("world simulation: world bounds publish final collider geometry before returning", () => {
    const core = new GameCore({ role: Origin.SERVER, numOfChunksX: 1, numOfChunksY: 1, fixedDeltaMs: 40 });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1270, 100]) as Player;
        player.setInput(new InputSnapshot("0=2:0#5:1"));
        core.step();
        assert.equal(player.Transform.X, 1279);
        for (const collider of player.Colliders) {
            assert.equal(collider.Body.x, player.Transform.X);
            assert.equal(collider.Body.y, player.Transform.Y);
        }
    } finally {
        core.dispose();
    }
});

test("world simulation: a single-row staggered map clamps the lower edge of odd columns", () => {
    const core = new GameCore({ role: Origin.SERVER, chunkSize: 100, numOfChunksX: 2, numOfChunksY: 1 });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [150, 90]);
        player.Transform.Y = 120;
        core.step();
        assert.equal(player.Transform.Y, 99);
        assert.equal(core.ChunksManager.getObjectChunk(player), core.ChunksManager.Chunks[1][0]);
        assert.equal(player.Colliders[0].Body.y, 99);
    } finally {
        core.dispose();
    }
});
