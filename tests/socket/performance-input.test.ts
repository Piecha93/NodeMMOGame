import assert from "node:assert/strict";
import test from "node:test";
import { Server, Socket } from "socket.io";
import { GameServer } from "../../server/GameServer";
import { GameCore } from "../../shared/GameCore";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { decodeSnapshot } from "../../shared/protocol";
import { Player } from "../../shared/game_utils/game/objects/Player";

class SocketProbe {
    readonly request = { session: { user_id: "Guest perf-input" } };
    readonly handlers = new Map<string, (...args: unknown[]) => void>();
    readonly updates: ArrayBuffer[][] = [];
    connected = true;
    compress() {
        return this;
    }
    on(event: string, listener: (...args: unknown[]) => void) {
        this.handlers.set(event, listener);
        return this;
    }
    emit(event: string, ...args: unknown[]) {
        if (event === SocketMsgs.UPDATE_GAME || event === SocketMsgs.FIRST_UPDATE_GAME)
            this.updates.push(args[0] as ArrayBuffer[]);
        return this;
    }
    disconnect() {
        this.connected = false;
        return this;
    }
    receive(event: string, payload: unknown) {
        const listener = this.handlers.get(event);
        assert.ok(listener);
        listener(payload);
    }
}

test("performance input: a slow tick ACKs the newest command, preserves bounded actions and promptly applies STOP", () => {
    const transport = {
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
    const server = new GameServer(transport as unknown as Server, { performance: true });
    const internals = server as unknown as {
        core: GameCore;
        onConnection(socket: Socket): void;
        collectAndSendUpdate(): void;
    };
    const socket = new SocketProbe();
    try {
        internals.onConnection(socket as unknown as Socket);
        socket.receive(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [2] });
        const initial = decodeSnapshot(socket.updates.at(-1)!);
        const player = internals.core.ObjectsManager.get(initial.localPlayerState!.id) as Player;
        const start = [...player.Transform.Position];
        const actions: Array<[number, number]> = [];
        player.Weapon = {
            use(_user, position) {
                actions.push(position);
            },
            equip() {},
            hide() {},
        };
        // Simulate input accumulating while a deliberately overloaded world cannot
        // step. Movement should never spend another 96 ticks replaying stale input.
        for (let seq = 0; seq < 96; seq++)
            socket.receive(SocketMsgs.INPUT_SNAPSHOT, {
                seq,
                horizontal: 0,
                vertical: seq === 95 ? 0 : 1,
                actions: [{ kind: "primary", x: 100 + seq, y: 200 }],
            });
        internals.core.step();
        internals.collectAndSendUpdate();
        assert.equal(decodeSnapshot(socket.updates.at(-1)!).lastProcessedInputSeq, 95);
        assert.deepEqual(player.Transform.Position, start);
        assert.equal(actions.length, 32, "queued actions retain the existing action rate limit");
        assert.deepEqual(actions[0], [100, 200]);
        assert.deepEqual(actions[31], [131, 200]);
        assert.equal(socket.connected, true);
        socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq: 96, horizontal: 0, vertical: 1 });
        internals.core.step();
        assert.ok(player.Transform.X > start[0]);
        const moved = [...player.Transform.Position];
        for (let seq = 97; seq < 110; seq++)
            socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq, horizontal: 0, vertical: seq === 109 ? 0 : 1 });
        internals.core.step();
        internals.collectAndSendUpdate();
        assert.equal(decodeSnapshot(socket.updates.at(-1)!).lastProcessedInputSeq, 109);
        assert.deepEqual(player.Transform.Position, moved);
        internals.core.step();
        assert.deepEqual(player.Transform.Position, moved);
    } finally {
        server.dispose();
    }
});
