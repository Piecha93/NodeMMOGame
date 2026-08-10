import assert from "node:assert/strict";
import {test} from "node:test";
import {Socket} from "socket.io-client";

import {HeartBeatSender} from "../../client/net/HeartBeatSender";
import {SocketMsgs} from "../../shared/net/SocketMsgs";

class FakeClientSocket {
    readonly emitted: Array<{event: string; args: unknown[]}> = [];
    readonly handlers: Map<string, (...args: unknown[]) => void> = new Map();

    on(event: string, handler: (...args: unknown[]) => void) {
        this.handlers.set(event, handler);
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        this.emitted.push({event, args});
        return this;
    }
}

test("socket/heartbeat: a missing response does not stop subsequent heartbeats", (context) => {
    context.mock.timers.enable({apis: ["setInterval"]});

    const socket = new FakeClientSocket();
    const sender = new HeartBeatSender(socket as unknown as Socket, 1000);

    sender.sendHeartBeat();
    sender.sendHeartBeat();
    assert.equal(socket.emitted.filter(({event}) => event === SocketMsgs.HEARTBEAT).length, 1);

    context.mock.timers.tick(3000);
    assert.equal(socket.emitted.filter(({event}) => event === SocketMsgs.HEARTBEAT).length, 4);

    sender.stopSendingHeartbeats();
    context.mock.timers.tick(1000);
    assert.equal(socket.emitted.filter(({event}) => event === SocketMsgs.HEARTBEAT).length, 4);
});
