import assert from "node:assert/strict";
import { test } from "node:test";
import { Server, Socket } from "socket.io";
import { GameServer } from "../../server/GameServer";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/SharedConfig";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { Snapshot, decodeSnapshot } from "../../shared/protocol";
import { applySnapshot } from "../../shared/replication/EntityAdapter";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Chunk } from "../../shared/chunks/Chunk";

class SocketProbe {
    readonly request = { session: { user_id: "Guest v2-test" } };
    readonly handlers = new Map<string, (...args: unknown[]) => void>();
    readonly emitted: Array<{ event: string; args: unknown[] }> = [];
    connected = true;
    compress() {
        return this;
    }
    on(event: string, handler: (...args: unknown[]) => void) {
        this.handlers.set(event, handler);
        return this;
    }
    emit(event: string, ...args: unknown[]) {
        this.emitted.push({ event, args });
        return this;
    }
    receive(event: string, ...args: unknown[]) {
        const handler = this.handlers.get(event);
        assert.ok(handler);
        handler(...args);
    }
    disconnect() {
        if (this.connected) {
            this.connected = false;
            this.handlers.get(SocketMsgs.DISCONNECT)?.();
        }
        return this;
    }
    snapshot(event = SocketMsgs.UPDATE_GAME): Snapshot {
        const frames = this.emitted.filter((message) => message.event === event).at(-1)?.args[0];
        assert.ok(Array.isArray(frames));
        return decodeSnapshot(frames as ArrayBuffer[]);
    }
}

function fixture() {
    const sockets = {
        on() {
            return this;
        },
        off() {
            return this;
        },
        emit() {
            return this;
        },
    };
    const server = new GameServer(sockets as unknown as Server, { world: { fixedDeltaMs: 40, random: () => 0.1 } });
    const internals = server as unknown as {
        core: GameCore;
        onConnection(socket: Socket): void;
        sendUpdate(chunks: Map<Chunk, ArrayBuffer>): void;
    };
    const socket = new SocketProbe();
    internals.onConnection(socket as unknown as Socket);
    socket.receive(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [2] });
    const client = new GameCore({ role: Origin.CLIENT, fixedDeltaMs: 40 });
    const first = socket.snapshot(SocketMsgs.FIRST_UPDATE_GAME);
    applySnapshot(client, first);
    assert.ok(first.localPlayerState);
    const player = internals.core.ObjectsManager.get(first.localPlayerState.id);
    assert.ok(player instanceof Player);
    return {
        server,
        core: internals.core,
        socket,
        client,
        player,
        flush() {
            internals.sendUpdate(new Map());
            const snapshot = socket.snapshot();
            applySnapshot(client, snapshot);
            return snapshot;
        },
        dispose() {
            server.dispose();
            client.dispose();
        },
    };
}

test("v2 game server: received inputs are acknowledged only after their simulation tick, including uint32 wrap and STOP", () => {
    const game = fixture();
    try {
        const x = game.player.Transform.X;
        game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq: 0xffffffff, horizontal: 0, vertical: 1 });
        game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq: 0, horizontal: 0, vertical: 0 });
        assert.equal(game.flush().lastProcessedInputSeq, null);
        assert.equal(game.player.Transform.X, x);
        game.core.step();
        const first = game.flush();
        assert.equal(first.lastProcessedInputSeq, 0xffffffff);
        assert.equal(first.localPlayerState?.transform.x, x + 10);
        game.core.step();
        assert.equal(game.flush().lastProcessedInputSeq, 0);
        assert.equal(game.player.Transform.X, x + 10);
        game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq: 0xffffffff, horizontal: 0, vertical: 1 });
        game.core.step();
        assert.equal(game.flush().lastProcessedInputSeq, 0);
        assert.equal(game.player.Transform.X, x + 10, "a stale command must not restart movement");
    } finally {
        game.dispose();
    }
});

test("v2 game server: multiple actions of the same kind execute once each and duplicates cannot repeat them", () => {
    const game = fixture();
    try {
        const used: Array<[number, number]> = [];
        game.player.Weapon = {
            use(_user, position) {
                used.push(position);
            },
            equip() {},
            hide() {},
        };
        const command = {
            seq: 5,
            horizontal: 0,
            vertical: 0,
            actions: [
                { kind: "primary", x: 200, y: 200 },
                { kind: "primary", x: 300, y: 300 },
            ],
        };
        game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, command);
        assert.equal(used.length, 0);
        game.core.step();
        assert.deepEqual(used, [
            [200, 200],
            [300, 300],
        ]);
        game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, command);
        game.core.step();
        assert.equal(used.length, 2);
    } finally {
        game.dispose();
    }
});

test("v2 game server: per-client interest sends explicit leave destruction and a complete create on return", () => {
    const game = fixture();
    try {
        game.player.Transform.X = 100;
        game.player.Transform.Y = 100;
        game.core.ChunksManager.rebuild();
        const remote = game.core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1400, 500]);
        game.flush();
        assert.ok(game.client.ObjectsManager.get(remote.ID));
        remote.Transform.X = 2700;
        game.core.ChunksManager.rebuild();
        const leave = game.flush();
        assert.ok(leave.records.some((record) => record.kind === "destroy" && record.id === remote.ID));
        assert.equal(game.client.ObjectsManager.get(remote.ID) === undefined, true);
        assert.equal(game.core.ObjectsManager.get(remote.ID), remote, "leaving interest must not destroy server state");
        remote.Transform.X = 1400;
        game.core.ChunksManager.rebuild();
        const enter = game.flush();
        assert.ok(enter.records.some((record) => record.kind === "create" && record.state.id === remote.ID));
        assert.equal(game.client.ObjectsManager.get(remote.ID)?.Transform.X, 1400);
        remote.Transform.X = 1401;
        game.core.ChunksManager.rebuild();
        assert.doesNotThrow(() => game.flush());
        assert.equal(game.client.ObjectsManager.get(remote.ID)?.Transform.X, 1401);
    } finally {
        game.dispose();
    }
});

test("v2 game server: action budget caps batched actions while STOP and its ACK still advance", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const game = fixture();
    try {
        let used = 0;
        game.player.Weapon = {
            use() {
                used++;
            },
            equip() {},
            hide() {},
        };
        const initialX = game.player.Transform.X;
        for (let seq = 1; seq <= 5; seq++) {
            game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, {
                seq,
                horizontal: 0,
                vertical: seq === 5 ? 0 : 1,
                actions: Array.from({ length: 8 }, () => ({ kind: "primary", x: 200, y: 200 })),
            });
            game.core.step();
        }
        assert.equal(used, 32, "eight actions per input must not amplify the per-client action budget");
        assert.equal(game.player.Vertical, 0);
        assert.equal(game.player.Transform.X, initialX + 40);
        assert.equal(game.flush().lastProcessedInputSeq, 5);

        t.mock.timers.tick(1000);
        game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, {
            seq: 6,
            horizontal: 0,
            vertical: 0,
            actions: [{ kind: "primary", x: 200, y: 200 }],
        });
        game.core.step();
        assert.equal(used, 33, "the action budget resets after its own window");
        assert.equal(game.flush().lastProcessedInputSeq, 6);
    } finally {
        game.dispose();
    }
});
