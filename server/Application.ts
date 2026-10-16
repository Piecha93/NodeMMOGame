import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import * as path from "node:path";
import express, { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import { Server, Socket } from "socket.io";

import { GameServer, GameServerOptions } from "./GameServer";
import { ApplicationConfig, readApplicationConfig, ServerConfig } from "./ServerConfig";
import { authenticateUser, parseLoginCredentials } from "./auth/Authentication";
import { LoginRateLimiter } from "./auth/LoginRateLimiter";
import { Database } from "./database/Database";
import { ManagedSessionStore, MongoSessionStore } from "./database/MongoSessionStore";
import { disabledUserRepository, UserRepository } from "./database/UserRepository";
import { seedDemoWorld } from "./runtime/DemoScenario";
import { PERFORMANCE_MAX_ENEMIES } from "../shared/gameplay/Performance";

const customParser = require("socket.io-msgpack-parser");
const COOKIE_NAME = "node-mmo.sid";

declare module "express-session" {
    interface SessionData {
        user_id?: string;
    }
}

interface AuthenticatedRequest extends IncomingMessage {
    session?: session.Session & Partial<session.SessionData>;
    sessionID?: string;
}

export interface ApplicationDependencies {
    readonly config?: ApplicationConfig;
    readonly userRepository?: UserRepository;
    readonly sessionStore?: ManagedSessionStore;
    readonly gameServerFactory?: (sockets: Server, options: GameServerOptions) => GameServer;
    readonly projectRoot?: string;
}

export interface Application {
    readonly app: Express;
    readonly httpServer: HttpServer;
    readonly sockets: Server;
    readonly gameServer: GameServer;
    readonly performanceServer: GameServer | null;
    start(): Promise<AddressInfo>;
    stop(): Promise<void>;
}

function sameOrigin(origin: string | undefined, host: string | undefined): boolean {
    if (!origin) return true;
    try {
        const url = new URL(origin);
        return (url.protocol === "http:" || url.protocol === "https:") && url.host === host;
    } catch {
        return false;
    }
}

export function createApplication(dependencies: ApplicationDependencies = {}): Application {
    const config = dependencies.config ?? readApplicationConfig();
    if (config.sessionStore === "external" && !dependencies.sessionStore) {
        throw new Error("SESSION_STORE=external requires an injected sessionStore");
    }
    const repository =
        dependencies.userRepository ?? (config.mongoUri ? new Database(config.mongoUri) : disabledUserRepository);
    const store: ManagedSessionStore =
        dependencies.sessionStore ??
        (config.sessionStore === "mongo"
            ? new MongoSessionStore(config.mongoUri ?? "", config.sessionMaxAgeMs)
            : new session.MemoryStore());
    if (config.environment === "production" && store instanceof session.MemoryStore) {
        throw new Error("Production requires a persistent session store");
    }

    const app = express();
    app.locals.performanceTests = config.enablePerformanceTests;
    app.disable("x-powered-by");
    if (config.trustProxy) app.set("trust proxy", 1);
    const middleware = session({
        name: COOKIE_NAME,
        secret: config.sessionSecret,
        store,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: config.cookieSecure,
            maxAge: config.sessionMaxAgeMs,
        },
    });
    app.use(express.urlencoded({ extended: false, limit: "4kb", parameterLimit: 4 }));
    app.use(middleware);
    app.use((request: Request, response: Response, next: NextFunction) => {
        if (!request.session) {
            response.status(503).send("Session storage is unavailable. Try again later.");
            return;
        }
        next();
    });
    const projectRoot = dependencies.projectRoot ?? path.resolve(__dirname, "../..");
    app.set("views", path.join(projectRoot, "views"));
    app.set("view engine", "ejs");
    app.use("/build", express.static(path.join(projectRoot, "dist", "public")));
    app.use(express.static(path.join(projectRoot, "public")));
    const loginLimiter = new LoginRateLimiter();

    const createRuntime = () => {
        const httpServer = createServer(app);
        const sockets = new Server(httpServer, {
            maxHttpBufferSize: ServerConfig.MAX_SOCKET_MESSAGE_SIZE,
            parser: customParser,
            allowRequest: (request, done) => done(null, sameOrigin(request.headers.origin, request.headers.host)),
        });
        sockets.engine.use((request: IncomingMessage, response: ServerResponse, next: NextFunction) =>
            middleware(request as Request, response as Response, next),
        );
        const authorize = (socket: Socket, next: (error?: Error) => void) => {
            const request = socket.request as AuthenticatedRequest;
            if (!request.session?.user_id || !request.sessionID) {
                next(new Error("You are not authorized to play the game. Please log in first."));
                return;
            }
            // Revalidate the store at namespace admission; a request cached by
            // Engine.IO must not authorize a session already removed by logout.
            request.session.reload((error: unknown) => {
                if (error || !request.session?.user_id || !request.sessionID) {
                    next(new Error("Your session has expired. Please log in again."));
                    return;
                }
                void socket.join(`session:${request.sessionID}`);
                next();
            });
        };
        sockets.use(authorize);
        const options: GameServerOptions = {
            userRepository: repository,
            expedition: config.demoScenario === "expedition",
            ...(config.demoScenario === "walls" ? { seedWorld: seedDemoWorld } : {}),
        };
        const gameServer = dependencies.gameServerFactory?.(sockets, options) ?? new GameServer(sockets, options);
        let performanceServer: GameServer | null = null;
        if (config.enablePerformanceTests) {
            const namespace = sockets.of("/performance");
            namespace.use(authorize);
            performanceServer = new GameServer(namespace, { userRepository: repository, performance: true });
        }
        return { httpServer, sockets, gameServer, performanceServer };
    };

    let runtime = createRuntime();
    let stopped = false;
    let starting: Promise<AddressInfo> | undefined;
    let stopping: Promise<void> | undefined;

    app.get("/", (request: Request, response: Response) => {
        if (request.session.user_id) response.redirect("/game");
        else response.render("index");
    });

    app.post("/login", async (request: Request, response: Response) => {
        const destination =
            config.enablePerformanceTests && request.query.mode === "performance" ? "/game?mode=performance" : "/game";
        if (!sameOrigin(request.get("origin"), request.get("host"))) {
            response.status(403).send("Cross-origin login is not allowed");
            return;
        }
        if (request.session.user_id) {
            response.redirect(destination);
            return;
        }
        if (!loginLimiter.allow(request.ip ?? "unknown")) {
            response.status(429).send("Too many login attempts. Try again later.");
            return;
        }
        const credentials = parseLoginCredentials(request.body as unknown);
        if (!credentials) {
            response.status(400).render("index", { error_message: "Valid username and password are required" });
            return;
        }
        const userId =
            credentials.username === "guest" && credentials.password === "guest"
                ? `Guest ${randomUUID()}`
                : (await authenticateUser(repository, credentials))?.id;
        if (!userId) {
            response.status(401).render("index", { error_message: "Bad username or password" });
            return;
        }

        await new Promise<void>((resolve, reject) =>
            request.session.regenerate((error: unknown) => {
                if (error) reject(error);
                else resolve();
            }),
        );
        request.session.user_id = userId;
        await new Promise<void>((resolve, reject) =>
            request.session.save((error: unknown) => {
                if (error) reject(error);
                else resolve();
            }),
        );
        response.redirect(destination);
    });

    app.post("/logout", (request: Request, response: Response, next: NextFunction) => {
        if (!sameOrigin(request.get("origin"), request.get("host"))) {
            response.status(403).send("Cross-origin logout is not allowed");
            return;
        }
        const sessionId = request.sessionID;
        request.session.destroy((error: unknown) => {
            if (error) {
                next(error);
                return;
            }
            runtime.sockets.in(`session:${sessionId}`).disconnectSockets(true);
            if (config.enablePerformanceTests)
                runtime.sockets.of("/performance").in(`session:${sessionId}`).disconnectSockets(true);
            response.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: config.cookieSecure });
            response.redirect("/");
        });
    });
    app.get("/logout", (_request: Request, response: Response) => {
        response.setHeader("Allow", "POST");
        response.status(405).send("Use the Log out button to end your session.");
    });
    app.get("/game", (request: Request, response: Response) => {
        if (!request.session.user_id) response.redirect("/");
        else if (request.query.mode === "performance" && !config.enablePerformanceTests)
            response.status(404).send("Performance tests are disabled");
        else
            response.render("game", {
                performanceMode: request.query.mode === "performance",
                performanceMaxEnemies: PERFORMANCE_MAX_ENEMIES,
            });
    });
    app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
        const status =
            typeof error === "object" &&
            error !== null &&
            "status" in error &&
            typeof error.status === "number" &&
            error.status >= 400 &&
            error.status < 500
                ? error.status
                : 500;
        response.status(status).send(status === 500 ? "Unable to complete the request" : "Invalid request");
    });

    const closeRuntime = async (): Promise<void> => {
        const errors: unknown[] = [];
        try {
            runtime.performanceServer?.dispose();
        } catch (error) {
            errors.push(error);
        }
        try {
            runtime.gameServer.dispose();
        } catch (error) {
            errors.push(error);
        }
        try {
            const closed = runtime.sockets.close();
            runtime.httpServer.closeAllConnections();
            await closed;
        } catch (error) {
            errors.push(error);
        }
        try {
            await store.close?.();
        } catch (error) {
            errors.push(error);
        }
        try {
            await repository.close();
        } catch (error) {
            errors.push(error);
        }
        stopped = true;
        if (errors.length) throw new AggregateError(errors, "Application cleanup failed");
    };

    return {
        app,
        get httpServer() {
            return runtime.httpServer;
        },
        get sockets() {
            return runtime.sockets;
        },
        get gameServer() {
            return runtime.gameServer;
        },
        get performanceServer() {
            return runtime.performanceServer;
        },
        start(): Promise<AddressInfo> {
            if (starting) return starting;
            if (stopping) return stopping.then(() => this.start());
            const address = runtime.httpServer.address();
            if (address && typeof address === "object") return Promise.resolve(address);
            if (stopped) {
                runtime = createRuntime();
                stopped = false;
            }
            starting = (async () => {
                try {
                    await repository.connect();
                    await store.connect?.();
                    runtime.gameServer.start();
                    runtime.performanceServer?.start();
                    await new Promise<void>((resolve, reject) => {
                        const onError = (error: Error) => reject(error);
                        runtime.httpServer.once("error", onError);
                        runtime.httpServer.listen(config.port, config.host, () => {
                            runtime.httpServer.off("error", onError);
                            resolve();
                        });
                    });
                    return runtime.httpServer.address() as AddressInfo;
                } catch (error) {
                    try {
                        await closeRuntime();
                    } catch (cleanupError) {
                        throw new AggregateError([error, cleanupError], "Application start failed");
                    }
                    throw error;
                }
            })().finally(() => {
                starting = undefined;
            });
            return starting;
        },
        stop(): Promise<void> {
            if (stopping) return stopping;
            if (stopped) return Promise.resolve();
            stopping = (async () => {
                if (starting) await starting.catch(() => {});
                if (!stopped) await closeRuntime();
            })().finally(() => {
                stopping = undefined;
            });
            return stopping;
        },
    };
}
