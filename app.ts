import {randomUUID} from "node:crypto";
import * as http from "node:http";
import * as path from "node:path";
import express, {NextFunction, Request, Response} from "express";
import session from "express-session";
import {Server} from "socket.io";

import {GameServer} from "./server/GameServer";
import {Database} from "./server/database/Database";
import {Origin, SharedConfig} from "./shared/SharedConfig";

const customParser = require("socket.io-msgpack-parser");

declare module "express-session" {
    interface SessionData {
        user_id: string;
    }
}

SharedConfig.ORIGIN = Origin.SERVER;

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";
const app = express();
const httpServer = http.createServer(app);
const sockets = new Server(httpServer, {
    allowEIO3: true,
    parser: customParser,
});

const sessionMiddleware = session({
    name: "node-mmo.sid",
    secret: process.env.SESSION_SECRET || randomUUID(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.SESSION_COOKIE_SECURE === "true",
    },
});

app.use(express.urlencoded({extended: true}));
app.use(sessionMiddleware);
sockets.engine.use(sessionMiddleware as never);

sockets.use((socket, next) => {
    const request = socket.request as http.IncomingMessage & {
        session?: session.Session & Partial<session.SessionData>;
    };

    if (request.session?.user_id) {
        next();
        return;
    }

    next(new Error("You are not authorized to play the game. Please log in first."));
});

const projectRoot = path.resolve(__dirname, "..");
app.set("views", path.join(projectRoot, "views"));
app.use(express.static(path.join(projectRoot, "public")));
app.set("view engine", "ejs");

app.get("/", (req: Request, res: Response) => {
    if (req.session.user_id) {
        res.redirect("/game");
        return;
    }

    res.render("index");
});

app.post("/login", async (req: Request, res: Response) => {
    if (req.session.user_id) {
        res.redirect("/game");
        return;
    }

    const {username, password} = req.body;
    if (!username || !password) {
        res.status(400).render("index", {error_message: "Username and password are required"});
        return;
    }

    if (username === "guest" && password === "guest") {
        req.session.user_id = `Guest ${randomUUID()}`;
        res.redirect("/game");
        return;
    }

    const user = await Database.Instance.findUserByName(username);
    if (user && user.password === password) {
        req.session.user_id = String(user._id);
        res.redirect("/game");
        return;
    }

    res.status(401).render("index", {error_message: "Bad username or password"});
});

app.get("/logout", (req: Request, res: Response, next: NextFunction) => {
    req.session.destroy((error) => {
        if (error) {
            next(error);
            return;
        }

        res.clearCookie("node-mmo.sid");
        res.redirect("/");
    });
});

app.get("/game", checkAuth, (_req: Request, res: Response) => {
    res.render("game");
});

const gameServer = new GameServer(sockets);
gameServer.start();

httpServer.listen(port, host, () => {
    console.log(`Node game server started at http://${host}:${port}`);
});

function checkAuth(req: Request, res: Response, next: NextFunction): void {
    if (!req.session.user_id) {
        res.redirect("/");
        return;
    }

    next();
}
