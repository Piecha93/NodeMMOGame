import assert from "node:assert/strict";
import { test } from "node:test";

import { ChunksManager } from "../../shared/chunks/ChunksManager";
import { GameObjectsFactory } from "../../shared/game_utils/factory/ObjectsFactory";
import { GameObjectsManager } from "../../shared/game_utils/factory/GameObjectsManager";
import { SharedConfig } from "../../shared/SharedConfig";

test("foundation/chunks: rectangular grids expose every configured chunk", () => {
    const originalConfig = {
        numOfChunksX: SharedConfig.numOfChunksX,
        numOfChunksY: SharedConfig.numOfChunksY,
        chunkSize: SharedConfig.chunkSize,
    };
    try {
        SharedConfig.numOfChunksX = 2;
        SharedConfig.numOfChunksY = 3;
        SharedConfig.chunkSize = 100;

        const objectsManager = new GameObjectsManager(() => {});
        const objectsFactory = new GameObjectsFactory(objectsManager);
        const manager = new ChunksManager(objectsManager, objectsFactory);
        const chunks = Array.from(manager.ChunksIterator());

        assert.equal(manager.Chunks.length, 2);
        assert.deepEqual(
            manager.Chunks.map((column) => column.length),
            [3, 3],
        );
        assert.equal(chunks.length, 6);
        assert.deepEqual(
            chunks.map((chunk) => chunk.Position),
            [
                [0, 0],
                [0, 1],
                [0, 2],
                [1, 0],
                [1, 1],
                [1, 2],
            ],
        );

        for (const chunk of chunks) {
            for (const neighbor of chunk.Neighbors) {
                assert.ok(chunks.includes(neighbor), "neighbor must belong to the configured grid");
                assert.ok(neighbor.Neighbors.includes(chunk), "chunk neighborhood must be symmetric");
            }
        }
    } finally {
        SharedConfig.numOfChunksX = originalConfig.numOfChunksX;
        SharedConfig.numOfChunksY = originalConfig.numOfChunksY;
        SharedConfig.chunkSize = originalConfig.chunkSize;
    }
});
