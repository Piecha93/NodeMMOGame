import session from "express-session";
import mongoose, { Connection, mongo } from "mongoose";

interface StoredSession {
    _id: string;
    data: string;
    expiresAt: Date;
}

export interface ManagedSessionStore extends session.Store {
    connect?(): Promise<void>;
    close?(): Promise<void>;
}

/** Mongo TTL is housekeeping; get() also rejects expired records immediately. */
export class MongoSessionStore extends session.Store implements ManagedSessionStore {
    private connection: Connection | undefined;
    private collection: mongo.Collection<StoredSession> | undefined;
    private connecting: Promise<void> | undefined;

    constructor(
        private readonly uri: string,
        private readonly defaultMaxAgeMs: number,
    ) {
        super();
    }

    connect(): Promise<void> {
        if (this.connecting) return this.connecting;
        if (this.collection) return Promise.resolve();
        const connection = mongoose.createConnection(this.uri, { serverSelectionTimeoutMS: 5000 });
        connection.on("error", (error: Error) => console.error("Session store connection error:", error.message));
        connection.on("disconnected", () => {
            if (this.connection === connection) this.emit("disconnect");
        });
        connection.on("connected", () => {
            if (this.connection === connection && this.collection) this.emit("connect");
        });
        this.connection = connection;
        this.connecting = connection
            .asPromise()
            .then(async () => {
                if (!connection.db) throw new Error("MongoDB session connection has no database");
                const collection = connection.db.collection<StoredSession>("sessions");
                await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
                this.collection = collection;
                this.emit("connect");
            })
            .catch(async (error: unknown) => {
                await connection.close().catch(() => {});
                this.connection = undefined;
                this.emit("disconnect");
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
        this.connection = undefined;
        this.collection = undefined;
        this.emit("disconnect");
        await connection?.close();
    }

    get(id: string, callback: (error: unknown, data?: session.SessionData | null) => void): void {
        void this.read(id).then((data) => callback(null, data), callback);
    }

    set(id: string, data: session.SessionData, callback?: (error?: unknown) => void): void {
        this.complete(async () => {
            const record = { data: JSON.stringify(data), expiresAt: this.expiration(data) };
            await this.requireCollection().updateOne({ _id: id }, { $set: record }, { upsert: true });
        }, callback);
    }

    destroy(id: string, callback?: (error?: unknown) => void): void {
        this.complete(async () => {
            await this.requireCollection().deleteOne({ _id: id });
        }, callback);
    }

    touch(id: string, data: session.SessionData, callback?: (error?: unknown) => void): void {
        // Do not upsert: a late polling response must never resurrect a logged-out session.
        this.complete(async () => {
            await this.requireCollection().updateOne({ _id: id }, { $set: { expiresAt: this.expiration(data) } });
        }, callback);
    }

    private async read(id: string): Promise<session.SessionData | null> {
        const record = await this.requireCollection().findOne({ _id: id, expiresAt: { $gt: new Date() } });
        if (!record) return null;
        const data = JSON.parse(record.data) as session.SessionData;
        data.cookie.expires = record.expiresAt;
        return data;
    }

    private expiration(data: session.SessionData): Date {
        return data.cookie.expires ? new Date(data.cookie.expires) : new Date(Date.now() + this.defaultMaxAgeMs);
    }

    private requireCollection(): mongo.Collection<StoredSession> {
        if (!this.collection) throw new Error("Session store is not connected");
        return this.collection;
    }

    private complete(operation: () => Promise<void>, callback?: (error?: unknown) => void): void {
        void Promise.resolve()
            .then(operation)
            .then(
                () => callback?.(),
                (error: unknown) => callback?.(error),
            );
    }
}
