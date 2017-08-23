import * as express from 'express';
import * as express_session from 'express-session'
import * as http from 'http';
import * as io from 'socket.io';
import * as path from 'path'
import * as connectMongo from 'connect-mongo';
import * as bodyParser from 'body-parser'

import {Request, Response} from "express";
import {MongoStore} from "connect-mongo";
import {GameServer} from "./server/GameServer";
import {CommonConfig, Origin} from "./Common/CommonConfig";
import {Database, IUserModel} from "./server/database/Database";
import {Types} from "./Common/utils/game/GameObjectTypes";

CommonConfig.ORIGIN = Origin.SERVER;
const port: number = process.env.PORT || 3000;

const app: express.Application = express();

const server: http.Server = http.createServer(app);
let sockets: SocketIO.Server = io.listen(server);

let database: Database = Database.Instance;

const MongoStoreExpress = connectMongo(express_session);
let sessionStore: MongoStore = new MongoStoreExpress({mongooseConnection: database.DB});

const session = express_session({
    store: sessionStore,
    secret: "mysecret",
    resave: true,
    saveUninitialized: true
});

sockets.use((socket, next) => {
    session(socket.request, socket.request.res, next);
});

sockets.use((socket, next) => {
    if (socket.request.session.user_id) {
        next();
    } else {
        console.log("You are not authorized to play game. Please login first.");
    }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session);

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.get('/', (req: Request, res: Response) => {
    if(req.session.user_id) {
        res.redirect('game');
    } else {
        res.render('index');
    }
});

app.post('/login', (req: Request, res: Response) => {
    if(req.session.user_id) {
        return res.redirect('game');
    }

    let post = req.body;
    if(post.username && post.password) {
        if(post.username == "guest" && post.password == "guest") {
            req.session.user_id = "Guest" + nextGuestNumber();
            console.log(req.session.user_id);
            return res.redirect('/game');
        }

        database.findUserByName(post.username, (user: IUserModel) => {
            if(user && user.password == post.password ) {
                req.session.user_id = user._id;
                return res.redirect('/game');
            } else {
                return res.render('index', {
                    error_message: 'Bad username or password'
                });
            }
        });
    }
});

app.get('/logout', (req: Request, res: Response) => {
    delete req.session.user_id;
    return res.redirect('/');
});

app.get('/game', checkAuth, (req: Request, res: Response) => {
    res.render('game');
});

Types.Init();
let gameServer: GameServer = new GameServer(sockets);
gameServer.start();

server.listen(port);
console.log('Node gameServer started at ' + port);

function checkAuth(req: Request, res: Response, next: Function) {
    if (!req.session.user_id) {
        res.send('You are not authorized to view this page');
    } else {
        next();
    }
}

let guestCounter: number = 0;

function nextGuestNumber(): number {
    guestCounter++;
    return guestCounter;
}