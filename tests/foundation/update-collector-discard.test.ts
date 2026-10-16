import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { UpdateCollector } from "../../shared/serialize/UpdateCollector";
import { legacyView } from "../../shared/replication/LegacyView";

const collector = (core: GameCore) => (core as unknown as { updateCollector: UpdateCollector }).updateCollector;

test("legacy discard: finalize changes, complete flags, leavers and tombstones without encoding", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [4100, 4100]);
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [200, 200]);
        const destroyed = core.ObjectsFactory.instantiateWithPosition("Wall", [300, 300]);
        core.collectUpdateFrames();
        const oldChunk = core.ChunksManager.getObjectChunk(wall)!;
        wall.Transform.X = 4000;
        wall.Transform.Y = 4000;
        core.ChunksManager.rebuild();
        const newChunk = core.ChunksManager.getObjectChunk(wall)!;
        oldChunk.IsNextUpdateComplete = true;
        newChunk.IsNextUpdateComplete = true;
        destroyed.destroy();
        const view = legacyView(wall);
        const serialize = view.serializePreservingChanges;
        view.serializePreservingChanges = () => {
            throw new Error("discard must not encode a legacy record");
        };
        collector(core).discardUpdate();
        view.serializePreservingChanges = serialize;
        assert.equal(oldChunk.Leavers.length, 0);
        assert.equal(oldChunk.IsNextUpdateComplete, false);
        assert.equal(newChunk.IsNextUpdateComplete, false);
        assert.equal(
            core.collectUpdateFrames().size,
            0,
            "discarded changes and tombstones cannot leak into later deltas",
        );
        wall.Transform.X = 4001;
        assert.equal(core.collectUpdateFrames().size, 1, "fresh legacy deltas still encode after a discarded interval");
    } finally {
        core.dispose();
    }
});

test("legacy discard: unobserved chunks retain complete state for a future observer", () => {
    const core = new GameCore({ role: Origin.SERVER });
    const client = new GameCore({ role: Origin.CLIENT });
    try {
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [4000, 4000]);
        const chunk = core.ChunksManager.getObjectChunk(wall)!;
        chunk.IsNextUpdateComplete = true;
        for (let index = 0; index < 10; index++) {
            wall.Transform.X = 4000 + index;
            collector(core).discardUpdate();
        }
        assert.equal(chunk.IsNextUpdateComplete, true);
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [4100, 4100]);
        const frames = [...core.collectUpdateFrames().values()].flat();
        client.decodeUpdateFrames(frames);
        assert.equal(client.ObjectsManager.get(wall.ID)?.Transform.X, 4009);
    } finally {
        core.dispose();
        client.dispose();
    }
});
