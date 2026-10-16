import { UserRecord, UserRepository } from "../database/UserRepository";
import { hashPassword, spendPasswordVerificationTime, verifyLegacyPassword, verifyPassword } from "./Passwords";

export interface LoginCredentials {
    readonly username: string;
    readonly password: string;
}

export function parseLoginCredentials(body: unknown): LoginCredentials | null {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const { username, password } = body as Record<string, unknown>;
    if (typeof username !== "string" || typeof password !== "string") return null;
    const name = username.trim();
    if (!name || name.length > 64 || /\p{C}/u.test(username) || !password || Buffer.byteLength(password, "utf8") > 1024)
        return null;
    return { username: name, password };
}

export async function authenticateUser(
    repository: UserRepository,
    { username, password }: LoginCredentials,
): Promise<UserRecord | null> {
    const user = await repository.findUserByName(username);
    if (!user) {
        await spendPasswordVerificationTime(password);
        return null;
    }

    if (user.passwordHash) {
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        if (
            user.legacyPassword !== undefined &&
            !(await repository.migrateLegacyPassword(user.id, user.legacyPassword, user.passwordHash))
        )
            return null;
        return { id: user.id, username: user.username, passwordHash: user.passwordHash };
    }

    if (user.legacyPassword === undefined || !verifyLegacyPassword(password, user.legacyPassword)) {
        await spendPasswordVerificationTime(password);
        return null;
    }

    const passwordHash = await hashPassword(password);
    if (await repository.migrateLegacyPassword(user.id, user.legacyPassword, passwordHash)) {
        return { id: user.id, username: user.username, passwordHash };
    }
    // A concurrent login may already have migrated the same account. Never
    // authenticate against a stale plaintext value after the compare-and-set fails.
    const current = await repository.findUserById(user.id);
    return current?.passwordHash &&
        current.legacyPassword === undefined &&
        (await verifyPassword(password, current.passwordHash))
        ? current
        : null;
}
