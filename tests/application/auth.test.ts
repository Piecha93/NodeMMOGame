import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import session from "express-session";
import { io, Socket } from "socket.io-client";
import { createApplication } from "../../server/Application";
import { readApplicationConfig } from "../../server/ServerConfig";

const parser = require("socket.io-msgpack-parser");
const config = () =>
    readApplicationConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        DEMO_SCENARIO: "none",
        SESSION_SECRET: "application-auth-test-secret-at-least-32-bytes",
    });

function signedCookie(id: string, secret: string): string {
    const signature = createHmac("sha256", secret).update(id).digest("base64").replace(/=+$/, "");
    return `node-mmo.sid=${encodeURIComponent(`s:${id}.${signature}`)}`;
}

async function connect(socket: Socket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
    });
}

test("application/auth: guest login rotates the session and logout revokes HTTP and active sockets", {
    timeout: 10_000,
}, async (t) => {
    const settings = config();
    const store = new session.MemoryStore();
    const fixedId = "pre-login-session";
    const initialCookie = new session.Cookie();
    initialCookie.maxAge = 60_000;
    await new Promise<void>((resolve, reject) =>
        store.set(
            fixedId,
            {
                cookie: initialCookie,
            },
            (error) => (error ? reject(error) : resolve()),
        ),
    );
    const application = createApplication({ config: settings, sessionStore: store });
    let socket: Socket | undefined;
    t.after(async () => {
        socket?.disconnect();
        await application.stop();
    });
    const address = await application.start();
    const base = `http://127.0.0.1:${address.port}`;
    const login = await fetch(`${base}/login`, {
        method: "POST",
        redirect: "manual",
        headers: { cookie: signedCookie(fixedId, settings.sessionSecret) },
        body: new URLSearchParams({ username: "guest", password: "guest" }),
    });
    assert.equal(login.status, 302);
    assert.equal(login.headers.get("location"), "/game");
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    assert.notEqual(cookie, signedCookie(fixedId, settings.sessionSecret));
    assert.match(login.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(login.headers.get("set-cookie") ?? "", /SameSite=Lax/);
    assert.equal(
        await new Promise((resolve, reject) =>
            store.get(fixedId, (error, value) => (error ? reject(error) : resolve(value))),
        ),
        undefined,
    );
    assert.equal((await fetch(`${base}/game`, { headers: { cookie }, redirect: "manual" })).status, 200);

    socket = io(base, {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
        extraHeaders: { Cookie: cookie },
        parser,
    });
    await connect(socket);
    assert.equal(application.sockets.sockets.sockets.size, 1);
    const disconnected = new Promise<void>((resolve) => socket?.once("disconnect", () => resolve()));
    const logout = await fetch(`${base}/logout`, { method: "POST", headers: { cookie }, redirect: "manual" });
    assert.equal(logout.status, 302);
    await disconnected;
    assert.equal(application.sockets.sockets.sockets.size, 0);
    assert.equal((await fetch(`${base}/game`, { headers: { cookie }, redirect: "manual" })).status, 302);

    await assert.rejects(connect(socket), /authorized|expired/);
});

test("application/auth: malformed login and cross-origin actions fail before authentication", async (t) => {
    const application = createApplication({ config: config() });
    t.after(() => application.stop());
    const address = await application.start();
    const base = `http://127.0.0.1:${address.port}`;
    for (const body of [
        "username=a&username=b&password=x",
        "username%5B%24ne%5D=x&password=x",
        "username=a&password=",
    ]) {
        const result = await fetch(`${base}/login`, {
            method: "POST",
            redirect: "manual",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
        });
        assert.equal(result.status, 400);
        assert.equal(result.headers.get("set-cookie"), null);
    }
    const crossOrigin = await fetch(`${base}/login`, {
        method: "POST",
        headers: { origin: "https://other.example" },
        body: new URLSearchParams({ username: "guest", password: "guest" }),
        redirect: "manual",
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await fetch(`${base}/logout`, { redirect: "manual" })).status, 405);
});
