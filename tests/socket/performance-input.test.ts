import assert from "node:assert/strict";
import test from "node:test";
import { Server, Socket } from "socket.io";
import { GameServer } from "../../server/GameServer";
import { GameCore } from "../../shared/GameCore";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { decodeSnapshot } from "../../shared/protocol";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Origin } from "../../shared/SharedConfig";
import { InputCommand } from "../../shared/protocol";
import { V2Prediction } from "../../client/net/V2Prediction";
import { applySnapshot } from "../../shared/replication/EntityAdapter";
import { InputMovementBudget } from "../../server/runtime/InputMovementBudget";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";

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

function fixture(options: { maxCatchUpSteps?: number } = {}) {
    let nowMs = 0;
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
    const server = new GameServer(transport as unknown as Server, {
        performance: true,
        world: { clock: () => nowMs, ...options },
    });
    const internals = server as unknown as {
        core: GameCore;
        onConnection(socket: Socket): void;
        collectAndSendUpdate(): void;
    };
    const socket = new SocketProbe();
    internals.onConnection(socket as unknown as Socket);
    socket.receive(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [2] });
    const initial = decodeSnapshot(socket.updates.at(-1)!);
    const player = internals.core.ObjectsManager.get(initial.localPlayerState!.id) as Player;
    return {
        core: internals.core,
        socket,
        player,
        initial,
        advanceTime(ms: number) {
            nowMs += ms;
        },
        flush() {
            internals.collectAndSendUpdate();
            return decodeSnapshot(socket.updates.at(-1)!);
        },
        dispose() {
            server.dispose();
        },
    };
}

test("performance input: overloaded ticks simulate every ACKed movement and STOP before reconciling", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const game = fixture();
    const client = new GameCore({ role: Origin.CLIENT, performanceMode: true });
    try {
        applySnapshot(client, game.initial);
        const predicted = client.ObjectsManager.get(game.player.ID) as Player;
        const prediction = new V2Prediction(client.Runtime.config.fixedDeltaMs);
        const startX = game.player.Transform.X;
        let seq = 0xffffff80;
        // Four seconds of a 64 Hz client and a 16 Hz overloaded world. Batching
        // must preserve all 256 client movement steps, including sequence wrap.
        for (let batch = 0; batch < 65; batch++) {
            for (let index = 0; index < 4; index++) {
                const command: InputCommand = {
                    seq,
                    horizontal: 0,
                    vertical: batch === 64 ? 0 : 1,
                };
                seq = (seq + 1) >>> 0;
                prediction.predict(predicted, command);
                client.step();
                game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, command);
            }
            const beforeCorrection = [...predicted.Transform.Position];
            const elapsed = client.Runtime.config.fixedDeltaMs * 4;
            game.advanceTime(elapsed);
            t.mock.timers.tick(elapsed);
            game.core.step();
            const snapshot = game.flush();
            applySnapshot(client, snapshot);
            prediction.reconcile(
                predicted,
                snapshot.localPlayerState!,
                snapshot.lastProcessedInputSeq,
                client.CollisionsSystem,
                client.ChunksManager,
            );
            assert.deepEqual(predicted.Transform.Position, beforeCorrection, `batch ${batch} must not rewind`);
            assert.equal(prediction.PendingCount, 0);
            assert.equal(snapshot.lastProcessedInputSeq, (seq - 1) >>> 0);
        }
        assert.equal(game.player.Transform.X - startX, 1000);
        assert.equal(game.player.Vertical, 0);
        game.advanceTime(client.Runtime.config.fixedDeltaMs * 4);
        game.core.step();
        assert.equal(game.player.Transform.X - startX, 1000, "STOP and empty queues cannot repeat held movement");
        assert.equal(game.socket.connected, true);
    } finally {
        game.dispose();
        client.dispose();
    }
});

test("performance input: bounded world catch-up yields without discarding acknowledged player movement", () => {
    const game = fixture({ maxCatchUpSteps: 2 });
    const client = new GameCore({ role: Origin.CLIENT, performanceMode: true });
    try {
        applySnapshot(client, game.initial);
        const predicted = client.ObjectsManager.get(game.player.ID) as Player;
        const prediction = new V2Prediction(client.Runtime.config.fixedDeltaMs);
        for (let seq = 0; seq < 8; seq++) {
            const command: InputCommand = { seq, horizontal: 0, vertical: seq === 7 ? 0 : 1 };
            prediction.predict(predicted, command);
            client.step();
            game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, command);
        }
        const elapsed = game.core.Runtime.config.fixedDeltaMs * 8;
        game.advanceTime(elapsed);
        assert.equal(game.core.advance(elapsed), 2, "the stress world must yield before eight expensive AI ticks");
        assert.equal(game.core.droppedTimeMs, elapsed - game.core.Runtime.config.fixedDeltaMs * 2);
        const snapshot = game.flush();
        assert.equal(snapshot.lastProcessedInputSeq, 7);
        assert.deepEqual(game.player.Transform.Position, predicted.Transform.Position);
        const beforeCorrection = predicted.Transform.Position;
        prediction.reconcile(
            predicted,
            snapshot.localPlayerState!,
            snapshot.lastProcessedInputSeq,
            client.CollisionsSystem,
            client.ChunksManager,
        );
        assert.deepEqual(predicted.Transform.Position, beforeCorrection);
        assert.equal(prediction.PendingCount, 0);
    } finally {
        game.dispose();
        client.dispose();
    }
});

test("performance input: scheduled catch-up uses one queued command per world step without redundant physics", (t) => {
    const game = fixture();
    try {
        const fixed = game.core.Runtime.config.fixedDeltaMs;
        const startX = game.player.Transform.X;
        const enemy = game.core.ObjectsFactory.instantiateWithPosition("Michau", [
            startX + 200,
            game.player.Transform.Y,
        ]) as Enemy;
        enemy.configurePerformance("static", 0, () => [game.player]);
        const enemyUpdates = t.mock.method(enemy, "update");
        const collisionUpdates = t.mock.method(game.core.CollisionsSystem, "update");
        const snapshots: Array<{ ack: number | null; x: number }> = [];
        game.core.subscribeAfterStep(() => {
            const snapshot = game.flush();
            snapshots.push({ ack: snapshot.lastProcessedInputSeq, x: snapshot.localPlayerState!.transform.x });
        });
        for (let seq = 0; seq < 3; seq++)
            game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq, horizontal: 0, vertical: 1 });
        game.advanceTime(fixed * 3);
        assert.equal(game.core.advance(fixed * 3), 3);
        assert.deepEqual(
            snapshots,
            [0, 1, 2].map((ack) => ({
                ack,
                x: startX + (ack + 1) * game.player.Velocity * fixed,
            })),
        );
        assert.equal(enemyUpdates.mock.callCount(), 3, "every scheduled world tick still updates the enemy");
        assert.equal(
            collisionUpdates.mock.callCount(),
            3,
            "commands use existing world physics instead of extra scans",
        );
        assert.equal(game.core.Runtime.timeMs, fixed * 3);
        assert.equal(game.core.droppedTimeMs, 0);
    } finally {
        game.dispose();
    }
});

test("performance input: surplus catch-up batches only extra commands and preserves STOP and action origins", (t) => {
    const game = fixture();
    try {
        const fixed = game.core.Runtime.config.fixedDeltaMs;
        const startX = game.player.Transform.X;
        const distance = game.player.Velocity * fixed;
        const actions: Array<{ x: number; tick: number; target: number }> = [];
        game.player.Weapon = {
            use(user, position) {
                actions.push({ x: user.Transform.X, tick: user.Runtime.tick, target: position[0] });
            },
            equip() {},
            hide() {},
        };
        const collisionUpdates = t.mock.method(game.core.CollisionsSystem, "update");
        const snapshots: Array<{ ack: number | null; x: number }> = [];
        game.core.subscribeAfterStep(() => {
            const snapshot = game.flush();
            snapshots.push({ ack: snapshot.lastProcessedInputSeq, x: snapshot.localPlayerState!.transform.x });
        });
        for (let seq = 0; seq < 5; seq++)
            game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, {
                seq,
                horizontal: 0,
                vertical: seq === 4 ? 0 : 1,
                actions: [{ kind: "primary", x: seq, y: 200 }],
            });
        game.advanceTime(fixed * 3);
        assert.equal(game.core.advance(fixed * 3), 3);
        assert.deepEqual(snapshots, [
            { ack: 2, x: startX + 3 * distance },
            { ack: 3, x: startX + 4 * distance },
            { ack: 4, x: startX + 4 * distance },
        ]);
        assert.deepEqual(
            actions,
            [0, 1, 2, 3, 4].map((target) => ({
                x: startX + target * distance,
                tick: Math.max(0, target - 2),
                target,
            })),
        );
        assert.equal(
            collisionUpdates.mock.callCount(),
            5,
            "only the two surplus commands require extra movement physics",
        );
        assert.equal(game.player.Vertical, 0);
        game.core.step();
        assert.equal(game.player.Transform.X, startX + 4 * distance, "STOP remains authoritative after catch-up");
        assert.equal(game.core.droppedTimeMs, 0);
    } finally {
        game.dispose();
    }
});

test("performance input: the worker world catches up eight real simulation ticks without dropping them", (t) => {
    const game = fixture();
    try {
        const fixed = game.core.Runtime.config.fixedDeltaMs;
        const startX = game.player.Transform.X;
        const collisionUpdates = t.mock.method(game.core.CollisionsSystem, "update");
        const acknowledgements: Array<number | null> = [];
        game.core.subscribeAfterStep(() => acknowledgements.push(game.flush().lastProcessedInputSeq));
        assert.equal(game.core.Runtime.config.maxCatchUpSteps, 8);
        for (let seq = 0; seq < 8; seq++)
            game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq, horizontal: 0, vertical: seq === 7 ? 0 : 1 });
        game.advanceTime(fixed * 8);
        assert.equal(game.core.advance(fixed * 8), 8);
        assert.deepEqual(acknowledgements, [0, 1, 2, 3, 4, 5, 6, 7]);
        assert.equal(collisionUpdates.mock.callCount(), 8);
        assert.equal(game.player.Transform.X, startX + 7 * game.player.Velocity * fixed);
        assert.equal(game.core.Runtime.timeMs, fixed * 8);
        assert.equal(game.core.droppedTimeMs, 0);
    } finally {
        game.dispose();
    }
});

test("performance input: reserved catch-up commands retain prediction's wall collision and final STOP", () => {
    const game = fixture();
    const client = new GameCore({ role: Origin.CLIENT, performanceMode: true });
    try {
        const fixed = game.core.Runtime.config.fixedDeltaMs;
        const startX = game.player.Transform.X;
        game.player.Velocity = 1;
        const wall = game.core.ObjectsFactory.instantiateWithPosition(
            "Wall",
            [startX + 72, game.player.Transform.Y],
            [32, 200],
        );
        assert.equal(wall.IsDestroyed, false);
        applySnapshot(client, game.initial);
        applySnapshot(client, game.flush());
        const predicted = client.ObjectsManager.get(game.player.ID) as Player;
        const prediction = new V2Prediction(fixed);
        for (let seq = 0; seq < 5; seq++) {
            const command: InputCommand = { seq, horizontal: 0, vertical: seq === 4 ? 0 : 1 };
            prediction.predict(predicted, command);
            client.step();
            game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, command);
        }
        game.advanceTime(fixed * 3);
        assert.equal(game.core.advance(fixed * 3), 3);
        const snapshot = game.flush();
        assert.equal(snapshot.lastProcessedInputSeq, 4);
        assert.equal(game.player.Transform.X, startX + 40);
        assert.deepEqual(game.player.Transform.Position, predicted.Transform.Position);
        prediction.reconcile(
            predicted,
            snapshot.localPlayerState!,
            snapshot.lastProcessedInputSeq,
            client.CollisionsSystem,
            client.ChunksManager,
        );
        assert.equal(prediction.PendingCount, 0);
        assert.deepEqual(predicted.Transform.Position, game.player.Transform.Position);
        assert.equal(game.player.Vertical, 0);
    } finally {
        game.dispose();
        client.dispose();
    }
});

for (const mode of ["manual", "single scheduled"] as const)
    test(`performance input: a ${mode} world step still consumes the available movement backlog`, (t) => {
        const game = fixture();
        try {
            const fixed = game.core.Runtime.config.fixedDeltaMs;
            const startX = game.player.Transform.X;
            const collisionUpdates = t.mock.method(game.core.CollisionsSystem, "update");
            for (let seq = 0; seq < 4; seq++)
                game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq, horizontal: 0, vertical: seq === 3 ? 0 : 1 });
            game.advanceTime(fixed);
            if (mode === "manual") game.core.step();
            else assert.equal(game.core.advance(fixed), 1);
            assert.equal(game.flush().lastProcessedInputSeq, 3);
            assert.equal(game.player.Transform.X, startX + 3 * game.player.Velocity * fixed);
            assert.equal(collisionUpdates.mock.callCount(), 4);
            assert.equal(game.player.Vertical, 0);
            assert.equal(game.core.Runtime.tick, 1);
        } finally {
            game.dispose();
        }
    });

test("performance input: catch-up preserves action order, origin and the existing per-client action limit", () => {
    const game = fixture();
    try {
        const startX = game.player.Transform.X;
        const actions: Array<{ x: number; target: number }> = [];
        game.player.Weapon = {
            use(user, position) {
                actions.push({ x: user.Transform.X, target: position[0] });
            },
            equip() {},
            hide() {},
        };
        for (let seq = 0; seq < 8; seq++)
            game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, {
                seq,
                horizontal: 0,
                vertical: seq === 7 ? 0 : 1,
                actions: Array.from({ length: 8 }, (_, index) => ({ kind: "primary", x: seq * 8 + index, y: 200 })),
            });
        game.core.step();
        assert.equal(game.flush().lastProcessedInputSeq, 7);
        assert.equal(actions.length, 32);
        for (const [index, action] of actions.entries()) {
            assert.equal(action.target, index);
            assert.equal(
                action.x,
                startX + Math.floor(index / 8) * game.player.Velocity * game.core.Runtime.config.fixedDeltaMs,
            );
        }
        assert.equal(
            game.player.Transform.X,
            startX + 7 * game.player.Velocity * game.core.Runtime.config.fixedDeltaMs,
        );
        assert.equal(game.player.Vertical, 0);
    } finally {
        game.dispose();
    }
});

test("performance input: command flooding cannot amplify authoritative movement beyond elapsed time and bounded jitter credit", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const game = fixture();
    try {
        const fixed = game.core.Runtime.config.fixedDeltaMs;
        const startX = game.player.Transform.X;
        let seq = 0;
        for (let batch = 0; batch < 32; batch++) {
            // A valid transport rate of 128 commands/s cannot double movement.
            for (let index = 0; index < 4; index++)
                game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, { seq: seq++, horizontal: 0, vertical: 1 });
            game.advanceTime(fixed * 2);
            t.mock.timers.tick(fixed * 2);
            game.core.step();
        }
        const maximumSteps = 64 + InputMovementBudget.MAX_STEPS;
        const snapshot = game.flush();
        assert.ok(game.player.Transform.X - startX <= maximumSteps * game.player.Velocity * fixed);
        assert.ok(snapshot.lastProcessedInputSeq! < seq - 1, "unperformed commands must not be ACKed");
        assert.equal(game.socket.connected, true);
        const x = game.player.Transform.X;
        for (let repeat = 0; repeat < 10; repeat++) game.core.step();
        assert.equal(game.player.Transform.X, x, "repeated ticks at one instant cannot create more movement credit");
    } finally {
        game.dispose();
    }
});

test("performance input: batched movement uses the same wall collision as prediction", () => {
    const game = fixture();
    const client = new GameCore({ role: Origin.CLIENT, performanceMode: true });
    try {
        const startX = game.player.Transform.X;
        const wall = game.core.ObjectsFactory.instantiateWithPosition(
            "Wall",
            [startX + 72, game.player.Transform.Y],
            [32, 200],
        );
        assert.equal(wall.IsDestroyed, false);
        applySnapshot(client, game.initial);
        applySnapshot(client, game.flush());
        const predicted = client.ObjectsManager.get(game.player.ID) as Player;
        const prediction = new V2Prediction(client.Runtime.config.fixedDeltaMs);
        for (let batch = 0; batch < 4; batch++) {
            for (let index = 0; index < 8; index++) {
                const command: InputCommand = { seq: batch * 8 + index, horizontal: 0, vertical: 1 };
                prediction.predict(predicted, command);
                client.step();
                game.socket.receive(SocketMsgs.INPUT_SNAPSHOT, command);
            }
            const expected = [...predicted.Transform.Position];
            game.advanceTime(client.Runtime.config.fixedDeltaMs * 8);
            game.core.step();
            const snapshot = game.flush();
            prediction.reconcile(
                predicted,
                snapshot.localPlayerState!,
                snapshot.lastProcessedInputSeq,
                client.CollisionsSystem,
                client.ChunksManager,
            );
            assert.deepEqual(predicted.Transform.Position, expected);
            assert.equal(prediction.PendingCount, 0);
        }
        assert.equal(game.player.Transform.X, startX + 40);
    } finally {
        game.dispose();
        client.dispose();
    }
});

test("performance input: budget is bounded after a long pause and cannot refill on a backward clock", () => {
    const budget = new InputMovementBudget(10, 100);
    assert.equal(budget.take(100, 100), 8);
    assert.equal(budget.take(100, 100), 0);
    assert.equal(budget.take(100, 0), 0);
    assert.equal(budget.take(100, 110), 1);
    assert.equal(budget.take(100, 10000), 8);
    assert.equal(budget.take(100, 10000), 0);
});
