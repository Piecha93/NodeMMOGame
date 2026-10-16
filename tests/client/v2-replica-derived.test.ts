import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/SharedConfig";
import { Doors } from "../../shared/game_utils/game/objects/Doors";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { InputSnapshot } from "../../shared/input/InputSnapshot";
import { decodeSnapshot, encodeSnapshot, EntityRecord } from "../../shared/protocol";
import { applySnapshot, captureEntity } from "../../shared/replication/EntityAdapter";

test("v2 replica: replicated door state changes collision solidity without enabling remote prediction", () => {
    const server = new GameCore({ role: Origin.SERVER, fixedDeltaMs: 40 });
    const client = new GameCore({ role: Origin.CLIENT, fixedDeltaMs: 40 });
    try {
        const authority = server.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100]) as Player;
        const authorityDoor = server.ObjectsFactory.instantiateWithPosition("Doors", [160, 100]) as Doors;
        const publish = (snapshotId: number, records: readonly EntityRecord[]) => {
            applySnapshot(
                client,
                decodeSnapshot(
                    encodeSnapshot({
                        serverTick: snapshotId,
                        snapshotId,
                        lastProcessedInputSeq: null,
                        localPlayerState: captureEntity(authority),
                        records,
                    }),
                ),
            );
        };
        publish(
            0,
            [authority, authorityDoor].map((object) => ({ kind: "create", state: captureEntity(object) })),
        );
        const player = client.ObjectsManager.get(authority.ID);
        const door = client.ObjectsManager.get(authorityDoor.ID);
        assert.ok(player instanceof Player);
        assert.ok(door instanceof Doors);
        door.predictionEnabled = false;
        const walk = () => {
            player.setInput(new InputSnapshot("1=2:0#5:1"));
            for (let index = 0; index < 10; index++) client.step();
        };
        assert.equal(door.IsSolid, true);
        walk();
        assert.equal(player.Transform.X, 128);

        authorityDoor.open();
        publish(1, [
            { kind: "update", id: door.ID, prefab: "Doors", fields: { isOpen: true, spriteName: "doors_open" } },
        ]);
        assert.equal(door.IsSolid, false, "derived solidity must change immediately on replica application");
        walk();
        assert.equal(player.Transform.X, 200, "local prediction must pass through the open remote door");
        assert.equal(door.predictionEnabled, false);

        authorityDoor.open();
        publish(2, [
            { kind: "update", id: door.ID, prefab: "Doors", fields: { isOpen: false, spriteName: "doors_closed" } },
        ]);
        assert.equal(door.IsSolid, true);
        walk();
        assert.equal(player.Transform.X, 128);
    } finally {
        server.dispose();
        client.dispose();
    }
});
