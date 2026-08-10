import assert from "node:assert/strict";
import {test} from "node:test";

import {Chunk} from "../../shared/chunks/Chunk";
import {GameCore} from "../../shared/GameCore";
import {registerGameObjectPrefabs} from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {Vector2} from "../../shared/game_utils/physics/Transform";

registerGameObjectPrefabs();

const WALL_COMPLETE_RECORD_SIZE = 30;
const GAME_OBJECT_COMPLETE_MASK = 0x0F;
const TRANSFORM_COMPLETE_MASK = 0x1F;

function decodeObjectId(view: DataView, offset: number = 0): string {
    return String.fromCharCode(view.getUint8(offset)) + view.getUint32(offset + 1).toString();
}

function assertCompleteWallRecord(
    update: ArrayBuffer | undefined,
    expectedId: string,
    expectedPosition: Vector2,
    chunk: Chunk
): void {
    assert.ok(update, `missing update for chunk ${chunk.Position.join(",")}`);
    assert.equal(update.byteLength, WALL_COMPLETE_RECORD_SIZE);

    assertCompleteWallRecordAt(update, 0, expectedId, expectedPosition);
}

function assertCompleteWallRecordAt(
    update: ArrayBuffer,
    offset: number,
    expectedId: string,
    expectedPosition: Vector2
): void {
    assert.ok(update.byteLength >= offset + WALL_COMPLETE_RECORD_SIZE);

    const view = new DataView(update);
    assert.equal(decodeObjectId(view, offset), expectedId);
    assert.equal(view.getUint8(offset + 5), GAME_OBJECT_COMPLETE_MASK);
    assert.equal(view.getUint8(offset + 13), TRANSFORM_COMPLETE_MASK);
    assert.equal(view.getFloat32(offset + 18), expectedPosition[0]);
    assert.equal(view.getFloat32(offset + 22), expectedPosition[1]);
}

function installSerializeFailure(gameObject: GameObject, callToFail: number): () => void {
    const originalSerialize = gameObject.serializePreservingChanges;
    let calls = 0;

    gameObject.serializePreservingChanges = function(
        view: DataView,
        offset: number,
        complete: boolean = false
    ): number {
        calls++;
        if(calls === callToFail) {
            throw new Error("injected serialization failure");
        }
        return originalSerialize.call(this, view, offset, complete);
    };

    return () => {
        gameObject.serializePreservingChanges = originalSerialize;
    };
}

function assertSingleDestroyRecord(
    update: ArrayBuffer | undefined,
    expectedId: string,
    chunk: Chunk
): void {
    assert.ok(update, `missing destroy update for chunk ${chunk.Position.join(",")}`);
    assert.equal(update.byteLength, 6);

    const view = new DataView(update);
    assert.equal(view.getUint8(0), 0xFF);
    assert.equal(decodeObjectId(view, 1), expectedId);
}

function exerciseMovement(start: Vector2, destination: Vector2): void {
    const core = new GameCore();

    try {
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [4100, 4100]);
        const wall: GameObject = core.ObjectsFactory.instantiateWithPosition("Wall", start);

        core.collectUpdate();

        const oldChunk: Chunk = core.ChunksManager.getObjectChunk(wall);
        assert.ok(oldChunk);

        wall.Transform.X = destination[0];
        wall.Transform.Y = destination[1];
        core.ChunksManager.rebuild();

        const newChunk: Chunk = core.ChunksManager.getObjectChunk(wall);
        assert.ok(newChunk);
        assert.notEqual(newChunk, oldChunk);

        const movementUpdate: Map<Chunk, ArrayBuffer> = core.collectUpdate();
        assertCompleteWallRecord(movementUpdate.get(oldChunk), wall.ID, destination, oldChunk);
        assertCompleteWallRecord(movementUpdate.get(newChunk), wall.ID, destination, newChunk);

        assert.equal(core.collectUpdate().size, 0);
    } finally {
        core.dispose();
    }
}

test("foundation/update collector: moving to a later chunk fans out one complete record to both chunks", () => {
    exerciseMovement([200, 200], [4000, 4000]);
});

test("foundation/update collector: moving to an earlier chunk fans out one complete record to both chunks", () => {
    exerciseMovement([4000, 4000], [200, 200]);
});

test("foundation/update collector: failed fan-out preserves full updates and leavers for retry", () => {
    const core = new GameCore();

    try {
        const oldObserver = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        const newObserver = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [4100, 4100]);
        const wall: GameObject = core.ObjectsFactory.instantiateWithPosition("Wall", [200, 200]);
        core.collectUpdate();

        const oldChunk = core.ChunksManager.getObjectChunk(wall);
        wall.Transform.X = 4000;
        wall.Transform.Y = 4000;
        core.ChunksManager.rebuild();

        const newChunk = core.ChunksManager.getObjectChunk(wall);
        assert.ok(oldChunk);
        assert.ok(newChunk);
        assert.notEqual(newChunk, oldChunk);
        oldChunk.IsNextUpdateComplete = true;
        newChunk.IsNextUpdateComplete = true;

        const restoreSerialize = installSerializeFailure(wall, 2);
        try {
            assert.throws(() => core.collectUpdate(), /injected serialization failure/);
        } finally {
            restoreSerialize();
        }

        assert.equal(oldChunk.IsNextUpdateComplete, true);
        assert.equal(newChunk.IsNextUpdateComplete, true);
        assert.equal(oldChunk.Leavers.includes(wall), true);

        const retry = core.collectUpdate();
        const oldWallOffset = 5 + oldObserver.calcNeededBufferSize(true);
        const newWallOffset = 5 + newObserver.calcNeededBufferSize(true);
        const oldUpdate = retry.get(oldChunk);
        const newUpdate = retry.get(newChunk);
        assert.ok(oldUpdate);
        assert.ok(newUpdate);
        assertCompleteWallRecordAt(oldUpdate, oldWallOffset, wall.ID, [4000, 4000]);
        assertCompleteWallRecordAt(newUpdate, newWallOffset, wall.ID, [4000, 4000]);
        assert.equal(oldChunk.IsNextUpdateComplete, false);
        assert.equal(newChunk.IsNextUpdateComplete, false);
        assert.equal(oldChunk.Leavers.length, 0);
        assert.equal(core.collectUpdate().size, 0);
    } finally {
        core.dispose();
    }
});

test("foundation/update collector: failed later encoding preserves an earlier tombstone for retry", () => {
    const core = new GameCore();

    try {
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [4100, 4100]);
        const deletedWall = core.ObjectsFactory.instantiateWithPosition("Wall", [200, 200]);
        const failingWall = core.ObjectsFactory.instantiateWithPosition("Wall", [4000, 4000]);
        core.collectUpdate();

        const tombstoneChunk = core.ChunksManager.getObjectChunk(deletedWall);
        assert.ok(tombstoneChunk);
        deletedWall.destroy();
        failingWall.Transform.X = 4001;

        const restoreSerialize = installSerializeFailure(failingWall, 1);
        try {
            assert.throws(() => core.collectUpdate(), /injected serialization failure/);
        } finally {
            restoreSerialize();
        }

        const retry = core.collectUpdate();
        assertSingleDestroyRecord(retry.get(tombstoneChunk), deletedWall.ID, tombstoneChunk);
        assert.equal(core.collectUpdate().size, 0);
    } finally {
        core.dispose();
    }
});
