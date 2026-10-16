import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// One of OWASP's equivalent scrypt profiles, using 16 MiB per operation.
const PARAMETERS = Object.freeze({ N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 });
const KEY_BYTES = 64;
const PREFIX = "scrypt$1$16384$8$5$";
const DUMMY_HASH =
    PREFIX + Buffer.alloc(16).toString("base64url") + "$" + Buffer.alloc(KEY_BYTES).toString("base64url");

function derive(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, KEY_BYTES, PARAMETERS, (error, key) => {
            if (error) reject(error);
            else resolve(key);
        });
    });
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt);
    return PREFIX + salt.toString("base64url") + "$" + key.toString("base64url");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
    if (!encoded.startsWith(PREFIX)) return false;
    const fields = encoded.slice(PREFIX.length).split("$");
    const saltText = fields[0];
    const keyText = fields[1];
    if (
        fields.length !== 2 ||
        !saltText ||
        !keyText ||
        !/^[A-Za-z0-9_-]{22}$/.test(saltText) ||
        !/^[A-Za-z0-9_-]{86}$/.test(keyText)
    )
        return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (
        salt.length !== 16 ||
        expected.length !== KEY_BYTES ||
        salt.toString("base64url") !== saltText ||
        expected.toString("base64url") !== keyText
    )
        return false;
    return timingSafeEqual(await derive(password, salt), expected);
}

export function verifyLegacyPassword(password: string, legacy: string): boolean {
    const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();
    return timingSafeEqual(digest(password), digest(legacy));
}

export async function spendPasswordVerificationTime(password: string): Promise<void> {
    await verifyPassword(password, DUMMY_HASH);
}
