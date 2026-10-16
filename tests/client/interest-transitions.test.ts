import assert from "node:assert/strict";
import { test } from "node:test";
import { GameClient } from "../../client/GameClient";
import { GameCore } from "../../shared/GameCore";
import { Chunk } from "../../shared/chunks/Chunk";
import { Origin, SharedConfig } from "../../shared/SharedConfig";
import { registerGameObjectPrefabs } from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";

interface ClientUpdateFixture {
    core: GameCore;
    coreChunk: Chunk;
    onServerUpdate(update: unknown): void;
}

test("client interest: leave, return and the following delta preserve visible entity lifecycle", () => {
    const origin = SharedConfig.ORIGIN;
    registerGameObjectPrefabs();
    SharedConfig.ORIGIN = Origin.SERVER;
    const server = new GameCore();
    let client: ClientUpdateFixture | undefined;

    try {
        const observer = server.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]);
        const remote = server.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1400, 500]);
        const interest = server.ChunksManager.getObjectChunk(observer);
        assert.ok(interest);
        const visible = (updates: Map<Chunk, ArrayBuffer>): ArrayBuffer[] =>
            [interest, ...interest.Neighbors].flatMap((chunk) => {
                const update = updates.get(chunk);
                return update ? [update] : [];
            });
        const initial = visible(server.collectUpdate());

        SharedConfig.ORIGIN = Origin.CLIENT;
        client = Object.create(GameClient.prototype) as ClientUpdateFixture;
        client.core = new GameCore();
        client.coreChunk = client.core.ChunksManager.Chunks[0][0];
        client.onServerUpdate(initial);
        assert.ok(client.core.ObjectsManager.get(remote.ID));

        SharedConfig.ORIGIN = Origin.SERVER;
        remote.Transform.X = 2700;
        server.ChunksManager.rebuild();
        const leave = visible(server.collectUpdate());
        SharedConfig.ORIGIN = Origin.CLIENT;
        client.onServerUpdate(leave);
        assert.equal(
            client.core.ObjectsManager.get(remote.ID) === undefined,
            true,
            "the last leaver update must remove an entity outside the current interest area",
        );

        SharedConfig.ORIGIN = Origin.SERVER;
        assert.equal(
            visible(server.collectUpdate()).length,
            0,
            "cleanup cannot depend on another world update arriving",
        );
        remote.Transform.X = 1400;
        server.ChunksManager.rebuild();
        const enter = visible(server.collectUpdate());
        SharedConfig.ORIGIN = Origin.CLIENT;
        client.onServerUpdate(enter);
        assert.equal(client.core.ObjectsManager.get(remote.ID)?.Transform.X, 1400);

        SharedConfig.ORIGIN = Origin.SERVER;
        remote.Transform.X = 1401;
        server.ChunksManager.rebuild();
        const delta = visible(server.collectUpdate());
        SharedConfig.ORIGIN = Origin.CLIENT;
        const activeClient = client;
        assert.doesNotThrow(() => activeClient.onServerUpdate(delta));
        assert.equal(client.core.ObjectsManager.get(remote.ID)?.Transform.X, 1401);
    } finally {
        SharedConfig.ORIGIN = Origin.SERVER;
        server.dispose();
        if (client) {
            SharedConfig.ORIGIN = Origin.CLIENT;
            client.core.dispose();
        }
        SharedConfig.ORIGIN = origin;
    }
});
