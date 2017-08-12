import * as express from 'express';
import * as express_session from 'express-session'
import * as http from 'http';
import * as io from 'socket.io';
import * as path from 'path'
import * as connectMongo from 'connect-mongo';

import {GameServer} from "./server/GameServer";
import {CommonConfig, Origin} from "./Common/CommonConfig";
import {Database} from "./server/Database";

CommonConfig.ORIGIN = Origin.SERVER;
const port: number = process.env.PORT || 3000;

const database: Database = new Database;

// var waitTill = new Date(new Date().getTime() + 11 * 1000);
// while(waitTill > new Date()){}

const app: express.Application = express();
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

let gameServer: GameServer = new GameServer(sockets);
gameServer.start();
server.listen(port);

/*this.socket.use((socket: SocketIO.Socket, next: Function) => {
 next();
 });*/

//TODO find express-socket.io-session @types (sharedsession)