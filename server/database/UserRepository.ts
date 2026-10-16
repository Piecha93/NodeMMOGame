export interface UserRecord {
    readonly id: string;
    readonly username: string;
    readonly passwordHash?: string;
    readonly legacyPassword?: string;
}

export interface UserRepository {
    connect(): Promise<void>;
    close(): Promise<void>;
    findUserByName(username: string): Promise<UserRecord | null>;
    findUserById(id: string): Promise<UserRecord | null>;
    migrateLegacyPassword(id: string, expectedPassword: string, passwordHash: string): Promise<boolean>;
}

export const disabledUserRepository: UserRepository = {
    async connect() {},
    async close() {},
    async findUserByName() {
        return null;
    },
    async findUserById() {
        return null;
    },
    async migrateLegacyPassword() {
        return false;
    },
};
