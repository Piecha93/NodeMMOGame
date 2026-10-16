import assert from "node:assert/strict";
import { test } from "node:test";
import { Socket } from "socket.io-client";
import { GameClient } from "../../client/GameClient";
import { Renderer } from "../../client/graphic/Renderer";
import { Chat } from "../../client/Chat";
import { GameCore } from "../../shared/GameCore";
import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { ExpeditionHud } from "../../client/graphic/ExpeditionHud";

class SocketProbe {
    connected = true;
    readonly handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    readonly emitted: Array<{ event: string; args: unknown[] }> = [];
    on(event: string, handler: (...args: unknown[]) => void) {
        let handlers = this.handlers.get(event);
        if (!handlers) this.handlers.set(event, (handlers = new Set()));
        handlers.add(handler);
        return this;
    }
    off(event: string, handler: (...args: unknown[]) => void) {
        this.handlers.get(event)?.delete(handler);
        return this;
    }
    emit(event: string, ...args: unknown[]) {
        this.emitted.push({ event, args });
        return this;
    }
    receive(event: string, ...args: unknown[]) {
        for (const handler of [...(this.handlers.get(event) ?? [])]) handler(...args);
    }
    disconnect() {
        if (this.connected) {
            this.connected = false;
            this.receive(SocketMsgs.DISCONNECT);
        }
        return this;
    }
}

test("game client lifecycle: renderer completion after disconnect is disposed without CLIENT_READY", async () => {
    const socket = new SocketProbe();
    let resolveRenderer: ((renderer: Renderer) => void) | undefined;
    const pending = new Promise<Renderer>((resolve) => {
        resolveRenderer = resolve;
    });
    let rendererDisposed = 0;
    let chatDisposed = 0;
    const client = new GameClient({
        socket: socket as unknown as Socket,
        createRenderer: () => pending,
        createChat: () =>
            ({
                dispose: () => {
                    chatDisposed++;
                },
            }) as unknown as Chat,
    });
    socket.disconnect();
    if (!resolveRenderer) throw new Error("Missing renderer resolver");
    resolveRenderer({
        dispose: () => {
            rendererDisposed++;
        },
    } as unknown as Renderer);
    await pending;
    await Promise.resolve();
    client.dispose();
    assert.equal(rendererDisposed, 1);
    assert.equal(chatDisposed, 1);
    assert.equal(
        socket.emitted.some(({ event }) => event === SocketMsgs.CLIENT_READY),
        false,
    );
    assert.equal(
        [...socket.handlers.values()].reduce((count, handlers) => count + handlers.size, 0),
        0,
    );
});

test("game client lifecycle: duplicate initialization creates one RAF and dispose releases all owned resources", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { value: new EventTarget(), configurable: true });
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
        else Reflect.deleteProperty(globalThis, "window");
    });
    const socket = new SocketProbe();
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    let rendererDisposed = 0;
    let chatDisposed = 0;
    const renderer = {
        createHUD() {},
        dispose() {
            rendererDisposed++;
        },
    } as unknown as Renderer;
    const client = new GameClient({
        socket: socket as unknown as Socket,
        createRenderer: async () => renderer,
        createChat: () =>
            ({
                dispose: () => {
                    chatDisposed++;
                },
            }) as unknown as Chat,
        requestFrame: (callback) => {
            frames.set(++nextFrame, callback);
            return nextFrame;
        },
        cancelFrame: (id) => {
            frames.delete(id);
        },
    });
    try {
        await Promise.resolve();
        socket.receive(SocketMsgs.INITIALIZE_GAME, { id: "A0", protocolVersion: 1 });
        socket.receive(SocketMsgs.INITIALIZE_GAME, { id: "A0", protocolVersion: 1 });
        const core = (client as unknown as { core: GameCore }).core;
        core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [100, 100], undefined, "A0");
        socket.receive(SocketMsgs.FIRST_UPDATE_GAME, []);
        socket.receive(SocketMsgs.FIRST_UPDATE_GAME, []);
        assert.equal(frames.size, 1);
        assert.equal(socket.emitted.filter(({ event }) => event === SocketMsgs.CLIENT_READY).length, 1);
        assert.equal(socket.emitted.filter(({ event }) => event === SocketMsgs.HEARTBEAT).length, 1);
        client.dispose();
        client.dispose();
        assert.equal(frames.size, 0);
        assert.equal(core.ObjectsManager.ObjectsById.size, 0);
        assert.equal(rendererDisposed, 1);
        assert.equal(chatDisposed, 1);
        const sent = socket.emitted.length;
        t.mock.timers.tick(5000);
        assert.equal(socket.emitted.length, sent);
        assert.equal(
            [...socket.handlers.values()].reduce((count, handlers) => count + handlers.size, 0),
            0,
        );
    } finally {
        client.dispose();
    }
});

test("game client lifecycle: server admission reason survives disconnect and generic connection loss is visible", async (t) => {
    const messages: string[] = [];
    t.mock.method(
        ExpeditionHud,
        "create",
        () =>
            ({
                showConnectionError: (message: string) => messages.push(message),
                dispose() {},
            }) as unknown as ExpeditionHud,
    );
    const create = () => {
        const socket = new SocketProbe();
        const client = new GameClient({
            socket: socket as unknown as Socket,
            createRenderer: async () => ({ createHUD() {}, dispose() {} }) as unknown as Renderer,
            createChat: () => ({ dispose() {} }) as unknown as Chat,
        });
        return { socket, client };
    };
    const rejected = create();
    rejected.socket.receive(SocketMsgs.ERROR, { unsafe: true });
    assert.equal(messages.length, 0);
    rejected.socket.receive(SocketMsgs.ERROR, "Drużyna jest już pełna.");
    rejected.socket.disconnect();
    assert.deepEqual(messages, ["Drużyna jest już pełna.", "Drużyna jest już pełna."]);
    assert.equal(rejected.socket.connected, false);
    rejected.client.dispose();
    const interrupted = create();
    interrupted.socket.receive("connect_error");
    assert.match(messages.at(-1) ?? "", /Połączenie z obozem zostało przerwane/);
    interrupted.client.dispose();
    await Promise.resolve();
});
