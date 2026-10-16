import mongoose, { Connection, Model } from "mongoose";
import { UserRecord, UserRepository } from "./UserRepository";

interface StoredUser {
    username: string;
    password?: string;
    passwordHash?: string;
}

export class Database implements UserRepository {
    private connection: Connection | undefined;
    private userModel: Model<StoredUser> | undefined;
    private connecting: Promise<void> | undefined;

    constructor(private readonly uri: string) {}

    connect(): Promise<void> {
        if (this.connecting) return this.connecting;
        if (this.userModel) return Promise.resolve();

        const connection = mongoose.createConnection(this.uri, { serverSelectionTimeoutMS: 5000 });
        connection.on("error", (error: Error) => console.error("Database connection error:", error.message));
        this.connection = connection;
        this.connecting = connection
            .asPromise()
            .then(async () => {
                const schema = new mongoose.Schema<StoredUser>({
                    username: { type: String, required: true, index: { unique: true } },
                    password: { type: String, select: false },
                    passwordHash: { type: String, select: false },
                });
                this.userModel = connection.model<StoredUser>("User", schema);
                await this.userModel.init();
            })
            .catch(async (error: unknown) => {
                await connection.close().catch(() => {});
                this.connection = undefined;
                this.userModel = undefined;
                throw error;
            })
            .finally(() => {
                this.connecting = undefined;
            });
        return this.connecting;
    }

    async close(): Promise<void> {
        await this.connecting?.catch(() => {});
        const connection = this.connection;
        this.userModel = undefined;
        this.connection = undefined;
        await connection?.close();
    }

    async findUserByName(username: string): Promise<UserRecord | null> {
        const user = await this.userModel?.findOne({ username }).select("+password +passwordHash").lean().exec();
        return user ? this.toUserRecord(user) : null;
    }

    async findUserById(id: string): Promise<UserRecord | null> {
        if (!mongoose.isObjectIdOrHexString(id)) return null;
        const user = await this.userModel?.findById(id).select("+password +passwordHash").lean().exec();
        return user ? this.toUserRecord(user) : null;
    }

    async migrateLegacyPassword(id: string, expectedPassword: string, passwordHash: string): Promise<boolean> {
        if (!this.userModel || !mongoose.isObjectIdOrHexString(id)) return false;
        const result = await this.userModel
            .updateOne(
                {
                    _id: id,
                    password: expectedPassword,
                    $or: [{ passwordHash: { $exists: false } }, { passwordHash }],
                },
                {
                    $set: { passwordHash },
                    $unset: { password: "" },
                },
            )
            .exec();
        return result.matchedCount === 1;
    }

    private toUserRecord(user: StoredUser & { _id: unknown }): UserRecord {
        return {
            id: String(user._id),
            username: user.username,
            ...(user.passwordHash === undefined ? {} : { passwordHash: user.passwordHash }),
            ...(user.password === undefined ? {} : { legacyPassword: user.password }),
        };
    }
}
