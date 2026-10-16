import assert from "node:assert/strict";
import { test } from "node:test";
import { Socket } from "socket.io-client";
import { InputSender } from "../../client/net/InputSender";
import { InputSnapshot } from "../../shared/input/InputSnapshot";
import { SocketMsgs } from "../../shared/net/SocketMsgs";

class SenderSocket {
    connected = true;
    readonly handlers = new Map<string, (...args: unknown[]) => void>();
    readonly sent: string[] = [];

    on(event: string, handler: (...args: unknown[]) => void) {
        this.handlers.set(event, handler);
        return this;
    }

    emit(event: string, payload: string) {
        assert.equal(event, SocketMsgs.INPUT_SNAPSHOT);
        this.sent.push(payload);
        return this;
    }
}

test("input sender: retries only held movement, ignores stale ACK and stops on matching ACK", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new SenderSocket();
    const sender = new InputSender(socket as unknown as Socket);
    sender.sendInput(new InputSnapshot("10=2:0#5:1#6:150,100#9:C1"));
    t.mock.timers.tick(100);
    assert.deepEqual(socket.sent, ["10=2:0#5:1#6:150,100#9:C1", "10=2:0#5:1"]);

    sender.sendInput(new InputSnapshot("11=2:0#5:0"));
    socket.handlers.get(SocketMsgs.UPDATE_SNAPSHOT_DATA)?.([10, 100]);
    t.mock.timers.tick(100);
    assert.equal(socket.sent.at(-1), "11=2:0#5:0");
    socket.handlers.get(SocketMsgs.UPDATE_SNAPSHOT_DATA)?.([11, 0]);
    const count = socket.sent.length;
    t.mock.timers.tick(1000);
    assert.equal(socket.sent.length, count);
});

test("input sender: disconnect cancels pending movement retries", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new SenderSocket();
    const sender = new InputSender(socket as unknown as Socket);
    sender.sendInput(new InputSnapshot("12=2:0#5:1"));
    socket.connected = false;
    socket.handlers.get(SocketMsgs.DISCONNECT)?.();
    t.mock.timers.tick(1000);
    assert.deepEqual(socket.sent, ["12=2:0#5:1"]);
});
