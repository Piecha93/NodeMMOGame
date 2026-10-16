import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import session from "express-session";
import mongoose from "mongoose";
import { Database } from "../../server/database/Database";
import { MongoSessionStore } from "../../server/database/MongoSessionStore";
import { authenticateUser } from "../../server/auth/Authentication";
import { verifyPassword } from "../../server/auth/Passwords";

const uri = process.env.TEST_MONGODB_URI;

function complete(operation: (callback: (error?: unknown) => void) => void): Promise<void> {
    return new Promise((resolve, reject) => operation((error) => (error ? reject(error) : resolve())));
}

function read(store: MongoSessionStore, id: string): Promise<session.SessionData | null | undefined> {
    return new Promise((resolve, reject) => store.get(id, (error, data) => (error ? reject(error) : resolve(data))));
}

test("application/mongo: credentials and sessions survive reconnect, expiry and logout stay authoritative", {
    skip: !uri && "Set TEST_MONGODB_URI to run the real persistence contract",
    timeout: 15_000,
}, async (t) => {
    assert.ok(uri);
    const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    assert.ok(connection.db);
    const users = connection.db.collection("users");
    const username = `test-${randomUUID()}`;
    const sessionId = `test-${randomUUID()}`;
    const inserted = await users.insertOne({ username, password: "legacy-🔑" });
    let repository = new Database(uri);
    let store = new MongoSessionStore(uri, 60_000);
    t.after(async () => {
        await complete((done) => store.destroy(sessionId, done)).catch(() => {});
        await store.close();
        await repository.close();
        await users.deleteOne({ _id: inserted.insertedId });
        await connection.close();
    });

    await repository.connect();
    assert.equal(
        (await authenticateUser(repository, { username, password: "legacy-🔑" }))?.id,
        String(inserted.insertedId),
    );
    const persisted = await users.findOne({ _id: inserted.insertedId });
    assert.ok(persisted);
    assert.equal("password" in persisted, false);
    assert.equal(typeof persisted.passwordHash, "string");
    assert.equal(await verifyPassword("legacy-🔑", String(persisted.passwordHash)), true);
    await repository.close();
    repository = new Database(uri);
    await repository.connect();
    assert.equal(
        (await authenticateUser(repository, { username, password: "legacy-🔑" }))?.id,
        String(inserted.insertedId),
    );

    const cookie = new session.Cookie();
    cookie.maxAge = 60_000;
    const data: session.SessionData = { cookie, user_id: String(inserted.insertedId) };
    await store.connect();
    await complete((done) => store.set(sessionId, data, done));
    await store.close();
    store = new MongoSessionStore(uri, 60_000);
    await store.connect();
    assert.equal((await read(store, sessionId))?.user_id, data.user_id);

    await complete((done) => store.destroy(sessionId, done));
    await complete((done) => store.touch(sessionId, data, done));
    assert.equal(await read(store, sessionId), null, "a late touch cannot recreate a logged-out session");

    data.cookie.expires = new Date(Date.now() - 1000);
    await complete((done) => store.set(sessionId, data, done));
    assert.equal(await read(store, sessionId), null, "expiry is enforced without waiting for the TTL worker");
});
