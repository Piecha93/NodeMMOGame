import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { io, Socket } from "socket.io-client";
import { normalizeBinaryPayload } from "../../client/net/BinaryPayload";
import { createApplication } from "../../server/Application";
import { readApplicationConfig } from "../../server/ServerConfig";
import { disabledUserRepository } from "../../server/database/UserRepository";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { PerformanceEvents, PerformanceState } from "../../shared/gameplay/Performance";
import { decodeSnapshot, decodeSnapshotV3, Snapshot } from "../../shared/protocol";

const parser = require("socket.io-msgpack-parser");
const settings = () =>
    readApplicationConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        DEMO_SCENARIO: "none",
        ENABLE_PERF_TESTS: "true",
    });

async function connect(socket: Socket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
    });
}

function event<T>(socket: Socket, name: string): Promise<T> {
    return new Promise((resolve) => socket.once(name, resolve));
}

function decode(payload: unknown, version: 2 | 3): Snapshot {
    assert.ok(Array.isArray(payload));
    const frames = payload.map(normalizeBinaryPayload);
    assert.ok(frames.every((frame) => frame !== null));
    return version === 3 ? decodeSnapshotV3(frames as ArrayBuffer[]) : decodeSnapshot(frames as ArrayBuffer[]);
}

function snapshot(socket: Socket, version: 2 | 3, matches: (state: Snapshot) => boolean): Promise<Snapshot> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => done(new Error("Timed out waiting for worker snapshot")), 5000);
        const receive = (payload: unknown) => {
            try {
                const state = decode(payload, version);
                if (matches(state)) done(undefined, state);
            } catch (error) {
                done(error);
            }
        };
        const done = (error?: unknown, state?: Snapshot) => {
            clearTimeout(timeout);
            socket.off(SocketMsgs.UPDATE_GAME, receive);
            if (error) reject(error);
            else resolve(state!);
        };
        socket.on(SocketMsgs.UPDATE_GAME, receive);
    });
}

async function login(base: string, username = "guest", password = "guest"): Promise<string> {
    const response = await fetch(`${base}/login?mode=performance`, {
        method: "POST",
        redirect: "manual",
        body: new URLSearchParams({ username, password }),
    });
    assert.equal(response.status, 302);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    return cookie;
}

for (const transport of ["polling", "websocket"] as const)
    test(`worker transport: ${transport} preserves v2/v3 binary state, processed ACKs, STOP and client isolation`, {
        timeout: 20_000,
    }, async (t) => {
        const application = createApplication({ config: settings() });
        const clients: Socket[] = [];
        t.after(async () => {
            for (const client of clients) client.disconnect();
            await application.stop();
        });
        const { port } = await application.start();
        const base = `http://127.0.0.1:${port}`;
        async function admit(version: 2 | 3) {
            const socket = io(`${base}/performance`, {
                autoConnect: false,
                forceNew: true,
                reconnection: false,
                transports: [transport],
                parser,
                extraHeaders: { Cookie: await login(base) },
            });
            clients.push(socket);
            await connect(socket);
            assert.equal(socket.io.engine.transport.name, transport);
            const initialized = event<{ id: string; protocolVersion: number; fixedDeltaMs: number }>(
                socket,
                SocketMsgs.INITIALIZE_GAME,
            );
            const first = event<unknown>(socket, SocketMsgs.FIRST_UPDATE_GAME);
            socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [version] });
            const [initialization, payload] = await Promise.all([initialized, first]);
            assert.equal(initialization.protocolVersion, version);
            const initial = decode(payload, version);
            assert.equal(initial.localPlayerState?.id, initialization.id);
            assert.equal(initial.lastProcessedInputSeq, null);
            assert.ok(Array.isArray(payload));
            return { socket, version, initial, initialization, frames: payload.length };
        }
        const first = await admit(2);
        const second = await admit(3);
        for (const client of [first, second]) {
            const before = client.initial.localPlayerState!;
            const moved = snapshot(client.socket, client.version, (state) => state.lastProcessedInputSeq === 1);
            client.socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: 1, horizontal: 0, vertical: 1 });
            const movement = await moved;
            assert.equal(
                movement.localPlayerState?.transform.x,
                before.transform.x + 0.25 * client.initialization.fixedDeltaMs,
            );
            assert.equal(movement.localPlayerState?.transform.y, before.transform.y);
            const stopped = snapshot(client.socket, client.version, (state) => state.lastProcessedInputSeq === 2);
            client.socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: 2, horizontal: 0, vertical: 0 });
            const stop = await stopped;
            assert.deepEqual(stop.localPlayerState?.transform, movement.localPlayerState?.transform);
            const still = await snapshot(client.socket, client.version, (state) => state.serverTick > stop.serverTick);
            assert.deepEqual(still.localPlayerState?.transform, stop.localPlayerState?.transform);
        }
        const populated = new Promise<PerformanceState>((resolve) => {
            const receive = (state: PerformanceState) => {
                if (state.enemies === 500 && state.pending === 0) {
                    first.socket.off(PerformanceEvents.STATE, receive);
                    resolve(state);
                }
            };
            first.socket.on(PerformanceEvents.STATE, receive);
        });
        first.socket.emit(PerformanceEvents.CONFIGURE, { count: 500, distribution: "nearby", scenario: "static" });
        await populated;
        const multipart = await admit(3);
        assert.ok(multipart.frames >= 2, "the whole multi-frame snapshot crosses the worker transfer boundary");
        assert.equal(
            multipart.initial.records.filter((record) => record.kind === "create" && record.state.prefab === "Michau")
                .length,
            500,
        );
        multipart.socket.disconnect();
        // Corrupt input only closes its sender. The other protocol and its worker
        // continue publishing state and processing commands.
        const malformedClosed = event<void>(first.socket, "disconnect");
        first.socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: 3, horizontal: Number.NaN, vertical: 1 });
        await malformedClosed;
        const survivor = snapshot(second.socket, 3, (state) => state.lastProcessedInputSeq === 3);
        second.socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq: 3, horizontal: 0, vertical: 0 });
        await survivor;
        assert.equal(second.socket.connected, true);
        const flooding = await admit(3);
        const floodClosed = event<void>(flooding.socket, "disconnect");
        for (let seq = 0; seq < 600; seq++)
            flooding.socket.emit(SocketMsgs.INPUT_SNAPSHOT, { seq, horizontal: 0, vertical: 0 });
        await floodClosed;
        assert.equal(second.socket.connected, true);
        const heartbeat = event<number>(second.socket, SocketMsgs.HEARTBEAT_RESPONSE);
        second.socket.emit(SocketMsgs.HEARTBEAT, 123);
        assert.equal(await heartbeat, 123);
        second.socket.disconnect();
        assert.ok(application.performanceServer);
        let diagnostic = await application.performanceServer.inspect();
        for (let attempt = 0; diagnostic.clients && attempt < 100; attempt++) {
            await delay(10);
            diagnostic = await application.performanceServer.inspect();
        }
        assert.equal(diagnostic.clients, 0);
        assert.equal(diagnostic.performance.objects, 0);
    });

test("worker admission: authenticated account names are resolved in the main repository before CLIENT_READY is delivered", {
    timeout: 15_000,
}, async (t) => {
    const unsafeName = "  Ａlïce<script>☃\u0000";
    let lookups = 0;
    const account = { id: "account-name-worker", username: unsafeName, legacyPassword: "correct-password" };
    const application = createApplication({
        config: settings(),
        userRepository: {
            ...disabledUserRepository,
            async findUserByName() {
                return account;
            },
            async migrateLegacyPassword() {
                return true;
            },
            async findUserById(id) {
                assert.equal(id, account.id);
                lookups++;
                await delay(10);
                return account;
            },
        },
    });
    let socket: Socket | undefined;
    t.after(async () => {
        socket?.disconnect();
        await application.stop();
    });
    const { port } = await application.start();
    const base = `http://127.0.0.1:${port}`;
    socket = io(`${base}/performance`, {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
        parser,
        extraHeaders: { Cookie: await login(base, "account", "correct-password") },
    });
    await connect(socket);
    const initialized = event<{ protocolVersion: number }>(socket, SocketMsgs.INITIALIZE_GAME);
    const first = event<unknown>(socket, SocketMsgs.FIRST_UPDATE_GAME);
    // Ready arrives while the main-process account lookup is still pending.
    socket.emit(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [3] });
    const [initialization, payload] = await Promise.all([initialized, first]);
    assert.equal(initialization.protocolVersion, 3);
    assert.equal(decode(payload, 3).localPlayerState?.fields.name, "Alïcescript");
    assert.equal(lookups, 1);
});
