import * as express from 'express';
import * as express_session from 'express-session'
import * as http from 'http';
import * as io from 'socket.io';
import * as path from 'path'
import * as connectMongo from 'connect-mongo';
import * as bodyParser from 'body-parser'

import {GameServer} from "./server/GameServer";
import {CommonConfig, Origin} from "./Common/CommonConfig";
import {Database} from "./server/database/Database";

CommonConfig.ORIGIN = Origin.SERVER;
const port: number = process.env.PORT || 3000;

const database: Database = new Database;

const app: express.Application = express();
app.use(bodyParser.urlencoded({ extended: true }));

const server: http.Server = http.createServer(app);
let sockets: SocketIO.Server = io.listen(server);

let MongoStore = connectMongo(express_session);
let sessionStore = new MongoStore({mongooseConnection: database.DB});
const session = express_session({
    store: sessionStore,
    secret: "mysecret",
    resave: true,
    saveUninitialized: true
});

sockets.use(function(socket, next) {
    session(socket.request, socket.request.res, next);
});

app.use(session);

console.log('Node gameServer started at ' + port);

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/login', (req, res) => {
    let post = req.body;
    let authenticated: boolean = false;
    if(post.username && post.password) {
        database.findUser(post.username, (user) => {
            if(user && user.password == post.password ) {
                authenticated = true;
                req.session.user_id = user._id;
            }
            if(authenticated) {
                res.redirect('/game');
            } else {
                res.send('Bad user/pass');
            }
        });
    }

});

app.get('/game', checkAuth, (req, res) => {
    res.render('game');
});


let gameServer: GameServer = new GameServer(sockets);
gameServer.start();
server.listen(port);

function checkAuth(req, res, next) {
    if (!req.session.user_id) {
        res.send('You are not authorized to view this page');
    } else {
        next();
    }
}

/*this.socket.use((socket: SocketIO.Socket, next: Function) => {
 next();
 });*/
