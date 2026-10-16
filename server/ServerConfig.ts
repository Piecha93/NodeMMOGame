import { randomBytes } from "node:crypto";

export interface ApplicationConfig {
    readonly host: string;
    readonly port: number;
    readonly environment: string;
    readonly sessionSecret: string;
    readonly cookieSecure: boolean;
    readonly sessionMaxAgeMs: number;
    readonly sessionStore: "memory" | "mongo" | "external";
    readonly mongoUri?: string;
    readonly demoScenario: "none" | "walls" | "expedition";
    readonly trustProxy: boolean;
}

export function readApplicationConfig(environment: NodeJS.ProcessEnv = process.env): ApplicationConfig {
    const mode = environment.NODE_ENV ?? "development";
    const port = environment.PORT === undefined ? 3000 : Number(environment.PORT);
    if (environment.PORT?.trim() === "" || !Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error("PORT must be an integer from 0 through 65535");
    }
    const store = environment.SESSION_STORE ?? (mode === "production" ? "mongo" : "memory");
    if (store !== "memory" && store !== "mongo" && store !== "external") {
        throw new Error("SESSION_STORE must be memory, mongo or external");
    }
    const secret = environment.SESSION_SECRET;
    if (secret !== undefined && !secret) throw new Error("SESSION_SECRET cannot be empty");
    if (mode === "production" && (!secret || Buffer.byteLength(secret, "utf8") < 32)) {
        throw new Error("Production requires SESSION_SECRET with at least 32 bytes");
    }
    const demoScenario = environment.DEMO_SCENARIO ?? "expedition";
    if (demoScenario !== "none" && demoScenario !== "walls" && demoScenario !== "expedition") {
        throw new Error("DEMO_SCENARIO must be none, walls or expedition");
    }
    if (mode === "production" && store === "memory") throw new Error("Production requires a persistent session store");
    if (store === "mongo" && !environment.MONGODB_URI) throw new Error("SESSION_STORE=mongo requires MONGODB_URI");
    for (const name of ["SESSION_COOKIE_SECURE", "TRUST_PROXY"] as const) {
        if (environment[name] !== undefined && !["true", "false"].includes(environment[name])) {
            throw new Error(`${name} must be true or false`);
        }
    }
    const cookieSecure =
        environment.SESSION_COOKIE_SECURE === undefined
            ? mode === "production"
            : environment.SESSION_COOKIE_SECURE === "true";
    if (mode === "production" && !cookieSecure) throw new Error("Production requires secure session cookies");
    const trustProxy = environment.TRUST_PROXY === "true";
    return Object.freeze({
        host: environment.HOST?.trim() || "127.0.0.1",
        port,
        environment: mode,
        sessionSecret: secret ?? randomBytes(32).toString("base64url"),
        cookieSecure,
        sessionMaxAgeMs: 24 * 60 * 60 * 1000,
        sessionStore: store,
        ...(environment.MONGODB_URI ? { mongoUri: environment.MONGODB_URI } : {}),
        demoScenario,
        trustProxy,
    });
}

export class ServerConfig {
    public static DATABASE_URL = process.env.MONGODB_URI;
    public static TICKRATE = (1 / 64) * 1000;
    public static CLIENT_TIMEOUT_TIME = 8000; //time in ms
    public static UPDATE_INTERVAL = (1 / 25) * 1000; //updates interval in ms (ex. 1 / 20 * 1000 => 20 updates per secound)
    public static DISCONNECT_CHECK_INTERVAL = 1000; //time in ms

    public static MAX_CHAT_MESSAGE_LENGTH = 500;
    public static MAX_SOCKET_MESSAGE_SIZE = 16 * 1024;
    public static RATE_LIMIT_WINDOW = 1000;
    public static MAX_CHAT_MESSAGES_PER_WINDOW = 5;
    public static MAX_INPUT_SNAPSHOTS_PER_WINDOW = 30;
    public static MAX_ACTIONS_PER_WINDOW = 32;
    public static MAX_HEARTBEATS_PER_WINDOW = 5;

    public static ENABLE_DEBUG_COMMANDS = process.env.ENABLE_DEBUG_COMMANDS === "true";
}
