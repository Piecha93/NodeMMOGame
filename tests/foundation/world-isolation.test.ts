import assert from "node:assert/strict";
import test from "node:test";

import {GameCore} from "../../shared/GameCore";
import {Chunk} from "../../shared/chunks/Chunk";
import {registerGameObjectPrefabs} from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import {Player} from "../../shared/game_utils/game/objects/Player";
import {SharedConfig} from "../../shared/SharedConfig";

registerGameObjectPrefabs();

test("foundation/world: two cores own independent objects, chunks and id sequences", () => {
    const first = new GameCore();
    const second = new GameCore();

    try {
        const firstWall = first.ObjectsFactory.instantiateWithPosition("Wall", [100, 100]);
        const secondWall = second.ObjectsFactory.instantiateWithPosition("Wall", [100, 100]);

        assert.equal(firstWall.ID, "C0");
        assert.equal(secondWall.ID, "C0");
        assert.equal(first.ObjectsManager.get("C0"), firstWall);
        assert.equal(second.ObjectsManager.get("C0"), secondWall);
        assert.notEqual(firstWall, secondWall);

        const firstChunk = first.ChunksManager.getObjectChunk(firstWall);
        const secondChunk = second.ChunksManager.getObjectChunk(secondWall);
        assert.ok(firstChunk?.hasObject(firstWall));
        assert.ok(secondChunk?.hasObject(secondWall));
        assert.equal(first.ChunksManager.getObjectChunk(secondWall), undefined);
        assert.equal(second.ChunksManager.getObjectChunk(firstWall), undefined);

        const firstPlayer = first.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [400, 400]) as Player;
        firstPlayer.Weapon.use(firstPlayer, [401, 400], 0);
        assert.equal(Array.from(first.ObjectsManager.ObjectsById.keys()).some((id) => id.startsWith("F")), true);
        assert.equal(Array.from(second.ObjectsManager.ObjectsById.keys()).some((id) => id.startsWith("F")), false);

        firstWall.destroy();
        assert.equal(first.ObjectsManager.get("C0"), undefined);
        assert.equal(firstChunk.hasObject(firstWall), false);
        assert.equal(second.ObjectsManager.get("C0"), secondWall);
        assert.equal(secondChunk.hasObject(secondWall), true);

        first.dispose();
        const nextSecondWall = second.ObjectsFactory.instantiateWithPosition("Wall", [200, 200]);
        assert.equal(nextSecondWall.ID, "C1");
        assert.equal(second.ObjectsManager.ObjectsById.size, 2);
    } finally {
        first.dispose();
        second.dispose();
    }
});

test("foundation/world: destroy tombstones use the object's owned chunk", () => {
    const core = new GameCore();

    try {
        const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [100, 100]);
        const ownedChunk = core.ChunksManager.getObjectChunk(wall);
        const positionDerivedChunk = core.ChunksManager.Chunks[1][0];
        assert.notEqual(positionDerivedChunk, ownedChunk);

        wall.Transform.X = SharedConfig.chunkSize + 100;
        wall.destroy();

        const collector = core as unknown as {
            updateCollector: {destroyedObjects: Map<Chunk, Set<string>>};
        };
        assert.equal(collector.updateCollector.destroyedObjects.get(ownedChunk).has(wall.ID), true);
        assert.equal(collector.updateCollector.destroyedObjects.get(positionDerivedChunk).has(wall.ID), false);
    } finally {
        core.dispose();
    }
});
