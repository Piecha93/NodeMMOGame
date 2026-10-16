import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyLegacyPassword, verifyPassword } from "../../server/auth/Passwords";
import { authenticateUser, parseLoginCredentials } from "../../server/auth/Authentication";
import { UserRecord, UserRepository } from "../../server/database/UserRepository";

class MemoryUsers implements UserRepository {
    user: UserRecord = { id: "user-1", username: "Zażółć", legacyPassword: "gęślą-jaźń" };
    migrations = 0;
    async connect() {}
    async close() {}
    async findUserByName(name: string) {
        return name === this.user.username ? this.user : null;
    }
    async findUserById(id: string) {
        return id === this.user.id ? this.user : null;
    }
    async migrateLegacyPassword(id: string, password: string, passwordHash: string) {
        this.migrations++;
        if (this.user.id !== id || this.user.legacyPassword !== password) return false;
        this.user = { id, username: this.user.username, passwordHash };
        return true;
    }
}

test("auth/passwords: scrypt uses unique salts and verifies Unicode without truncation", async () => {
    const password = " gęślą-jaźń 🔑 ";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    assert.notEqual(first, second);
    assert.equal(await verifyPassword(password, first), true);
    assert.equal(await verifyPassword(password.trim(), first), false);
    assert.equal(await verifyPassword(password + "x", first), false);
    assert.equal(verifyLegacyPassword("abc", "abcd"), false);
});

test("auth/passwords: malformed or unrecognized cost parameters are rejected", async () => {
    const valid = await hashPassword("correct");
    for (const invalid of [
        "",
        "plaintext",
        valid + "$tail",
        valid.replace("16384", "1073741824"),
        valid.slice(0, -1),
    ]) {
        assert.equal(await verifyPassword("correct", invalid), false);
    }
});

test("auth/migration: correct legacy login persists a hash and removes plaintext", async () => {
    const repository = new MemoryUsers();
    const user = await authenticateUser(repository, { username: "Zażółć", password: "gęślą-jaźń" });
    assert.equal(user?.id, "user-1");
    assert.equal(repository.migrations, 1);
    assert.equal(repository.user.legacyPassword, undefined);
    assert.ok(repository.user.passwordHash);
    assert.equal(await verifyPassword("gęślą-jaźń", repository.user.passwordHash), true);

    assert.equal((await authenticateUser(repository, { username: "Zażółć", password: "gęślą-jaźń" }))?.id, "user-1");
    assert.equal(repository.migrations, 1, "subsequent logins verify the stored hash");
    assert.equal(await authenticateUser(repository, { username: "Zażółć", password: "wrong" }), null);
});

test("auth/migration: a failed password never modifies legacy data", async () => {
    const repository = new MemoryUsers();
    assert.equal(await authenticateUser(repository, { username: "Zażółć", password: "wrong" }), null);
    assert.equal(repository.migrations, 0);
    assert.equal(repository.user.legacyPassword, "gęślą-jaźń");
});

test("auth/migration: failure to persist an upgrade does not authenticate stale plaintext", async () => {
    const repository = new MemoryUsers();
    repository.migrateLegacyPassword = async () => false;
    assert.equal(await authenticateUser(repository, { username: "Zażółć", password: "gęślą-jaźń" }), null);
});

test("auth/credentials: boundary rejects objects, duplicates, control characters and excessive passwords", () => {
    for (const value of [
        undefined,
        null,
        [],
        "name",
        { username: { $ne: null }, password: "x" },
        { username: ["a", "b"], password: "x" },
        { username: "a\n", password: "x" },
        { username: "a", password: "🔑".repeat(257) },
        { username: "a", password: "" },
    ]) {
        assert.equal(parseLoginCredentials(value), null);
    }
    assert.deepEqual(parseLoginCredentials({ username: "  User  ", password: " x " }), {
        username: "User",
        password: " x ",
    });
});
