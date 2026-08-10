import {strict as assert} from "node:assert";
import {test} from "node:test";

import {ClientsInputSnapshotHandler} from "../server/ClientsInputSnapshotHandler";
import {GameObjectsManager} from "../shared/game_utils/factory/GameObjectsManager";
import {GameObject} from "../shared/game_utils/game/objects/GameObject";
import {Player} from "../shared/game_utils/game/objects/Player";
import {InputSnapshot, InvalidInputSnapshotError} from "../shared/input/InputSnapshot";

class FakePlayer {
    readonly destroyListeners: Set<(destroyedObject: Player) => void> = new Set();
    readonly receivedSnapshots: InputSnapshot[] = [];
    readonly Transform = {
        distanceTo: () => 0,
    };

    setInput(snapshot: InputSnapshot) {
        this.receivedSnapshots.push(snapshot);
    }

    addDestroyListener(listener: (destroyedObject: Player) => void) {
        this.destroyListeners.add(listener);
    }

    destroy() {
        this.destroyListeners.forEach((listener: (destroyedObject: Player) => void) => {
            listener(this as unknown as Player);
        });
    }
}

test("input handler registers one destroy listener and removes the last snapshot", () => {
    const handler: ClientsInputSnapshotHandler = new ClientsInputSnapshotHandler();
    const fakePlayer: FakePlayer = new FakePlayer();
    const player: Player = fakePlayer as unknown as Player;

    for(let snapshotId = 0; snapshotId < 20; snapshotId++) {
        handler.setSnapshot(player, `${snapshotId}=2:0#5:0`);
    }

    assert.equal(fakePlayer.receivedSnapshots.length, 20);
    assert.equal(fakePlayer.destroyListeners.size, 1);
    assert.equal(handler.getPlayerLastSnapshot(player).ID, 19);

    fakePlayer.destroy();

    assert.equal(handler.getPlayerLastSnapshot(player), undefined);
});

test("input handler rejects invalid data before mutating player state", () => {
    const handler: ClientsInputSnapshotHandler = new ClientsInputSnapshotHandler();
    const fakePlayer: FakePlayer = new FakePlayer();
    const player: Player = fakePlayer as unknown as Player;

    handler.setSnapshot(player, "1=2:1#5:0");

    assert.throws(() => handler.setSnapshot(player, "malformed"), InvalidInputSnapshotError);
    assert.equal(fakePlayer.receivedSnapshots.length, 1);
    assert.equal(handler.getPlayerLastSnapshot(player).ID, 1);
    assert.equal(fakePlayer.destroyListeners.size, 1);
});

test("input handler ignores duplicate and stale snapshot ids", () => {
    const handler: ClientsInputSnapshotHandler = new ClientsInputSnapshotHandler();
    const fakePlayer: FakePlayer = new FakePlayer();
    const player: Player = fakePlayer as unknown as Player;
    let interactions: number = 0;
    const target = {
        Transform: {},
        interact: () => {
            interactions++;
        },
    } as unknown as GameObject;
    GameObjectsManager.gameObjectsMapById.set("A1", target);

    try {
        handler.setSnapshot(player, "10=2:1#5:0");
        handler.setSnapshot(player, "10=2:-1#5:0#9:A1");
        handler.setSnapshot(player, "9=2:-1#5:0#9:A1");
        handler.setSnapshot(player, "11=2:0#5:1#9:A1");
    } finally {
        GameObjectsManager.gameObjectsMapById.delete("A1");
    }

    assert.deepEqual(
        fakePlayer.receivedSnapshots.map((snapshot: InputSnapshot) => snapshot.ID),
        [10, 11],
    );
    assert.equal(interactions, 1);
    assert.equal(handler.getPlayerLastSnapshot(player).ID, 11);
    assert.equal(fakePlayer.destroyListeners.size, 1);
});
