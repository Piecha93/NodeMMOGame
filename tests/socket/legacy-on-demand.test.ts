import assert from "node:assert/strict";
import { test } from "node:test";
import type { Server, Socket } from "socket.io";
import { GameServer } from "../../server/GameServer";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { normalizeBinaryPayload } from "../../client/net/BinaryPayload";

class SocketProbe {
    readonly request: { session: { user_id: string } };
    readonly handlers = new Map<string, (...args: unknown[]) => void>();
    readonly emitted: Array<{ event: string; args: unknown[] }> = [];
    connected = true;

    constructor(name: string) {
        this.request = { session: { user_id: `Guest ${name}` } };
    }
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
    frames(event: string): ArrayBuffer[] {
        const frames = this.emitted.filter((message) => message.event === event).at(-1)?.args[0];
        assert.ok(Array.isArray(frames));
        return frames.map((payload) => {
            // The fake socket sees the serializer's DataView directly; the
            // browser applies this same normalization after MessagePack decode.
            const frame = normalizeBinaryPayload(payload);
            assert.ok(frame);
            return frame;
        });
    }
}

test("server replication: encode legacy only for recipients and synchronize the first v1 join after v2-only intervals", () => {
    const sockets = { on() {}, off() {}, emit() {} };
    const server = new GameServer(sockets as unknown as Server, { world: { random: () => 0.1 } });
    const internals = server as unknown as {
        core: GameCore;
        onConnection(socket: Socket): void;
        collectAndSendUpdate(): void;
    };
    const replica = new GameCore({ role: Origin.CLIENT });
    try {
        const modern = new SocketProbe("modern");
        internals.onConnection(modern as unknown as Socket);
        modern.receive(SocketMsgs.CLIENT_READY, { supportedProtocolVersions: [2] });
        const wall = internals.core.ObjectsFactory.instantiateWithPosition("Wall", [800, 800]);
        assert.equal(wall.IsDestroyed, false);
        const collect = internals.core.collectUpdateFrames.bind(internals.core);
        let legacyEncodings = 0;
        internals.core.collectUpdateFrames = () => {
            legacyEncodings++;
            return collect();
        };
        for (let index = 0; index < 12; index++) {
            wall.Transform.X = 800 + index;
            internals.collectAndSendUpdate();
        }
        assert.equal(legacyEncodings, 0, "v2-only snapshots must not pay for unused legacy frames");
        const legacy = new SocketProbe("legacy");
        internals.onConnection(legacy as unknown as Socket);
        legacy.receive(SocketMsgs.CLIENT_READY);
        replica.decodeUpdateFrames(legacy.frames(SocketMsgs.FIRST_UPDATE_GAME));
        internals.collectAndSendUpdate();
        assert.equal(legacyEncodings, 1);
        replica.decodeUpdateFrames(legacy.frames(SocketMsgs.UPDATE_GAME));
        assert.equal(replica.ObjectsManager.get(wall.ID)?.Transform.X, 811, "the new observer gets a complete entity");
        wall.Transform.X = 812;
        internals.collectAndSendUpdate();
        replica.decodeUpdateFrames(legacy.frames(SocketMsgs.UPDATE_GAME));
        assert.equal(replica.ObjectsManager.get(wall.ID)?.Transform.X, 812, "subsequent legacy deltas remain valid");
        wall.destroy();
        internals.collectAndSendUpdate();
        replica.decodeUpdateFrames(legacy.frames(SocketMsgs.UPDATE_GAME));
        assert.equal(replica.ObjectsManager.get(wall.ID), undefined);
        legacy.disconnect();
        const encodingsWithRecipient = legacyEncodings;
        internals.collectAndSendUpdate();
        assert.equal(legacyEncodings, encodingsWithRecipient, "encoding stops again when the last v1 recipient leaves");
        assert.equal(modern.connected, true, "switching legacy publication preserves the modern session");
    } finally {
        server.dispose();
        replica.dispose();
    }
});
