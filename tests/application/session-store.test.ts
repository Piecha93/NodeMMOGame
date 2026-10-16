import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import mongoose, { Connection } from "mongoose";
import { createApplication } from "../../server/Application";
import { readApplicationConfig } from "../../server/ServerConfig";
import { MongoSessionStore } from "../../server/database/MongoSessionStore";

class ConnectionProbe extends EventEmitter {
    readonly db = { collection: () => ({ createIndex: async () => "expiry" }) };
    async asPromise() {
        return this;
    }
    async close() {
        this.emit("disconnected");
    }
}

test("application/session-store: transient Mongo events and application restart recover HTTP sessions", async (t) => {
    const connections: ConnectionProbe[] = [];
    t.mock.method(mongoose, "createConnection", () => {
        const connection = new ConnectionProbe();
        connections.push(connection);
        return connection as unknown as Connection;
    });
    t.mock.method(console, "error", () => {});
    const config = readApplicationConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        DEMO_SCENARIO: "none",
        SESSION_SECRET: "session-store-recovery-test-secret-32-bytes",
    });
    const store = new MongoSessionStore("mongodb://not-contacted/test", 60_000);
    const application = createApplication({ config, sessionStore: store });
    t.after(() => application.stop());
    let address = await application.start();
    let base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(base)).status, 200);
    const connection = connections[0];
    assert.ok(connection);

    connection.emit("error", new Error("temporary command error"));
    assert.equal((await fetch(base)).status, 200, "an operation error alone does not disable the session store");

    connection.emit("disconnected");
    assert.equal((await fetch(base)).status, 503, "unavailable sessions have a controlled retryable response");
    connection.emit("connected");
    assert.equal((await fetch(base)).status, 200, "automatic Mongo reconnect restores session middleware");

    await application.stop();
    address = await application.start();
    base = `http://127.0.0.1:${address.port}`;
    assert.equal(connections.length, 2);
    assert.equal((await fetch(base)).status, 200, "a fresh connection after stop restores the existing middleware");
});
