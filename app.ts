import * as express from 'express';
import * as express_session from 'express-session'
import * as http from 'http';
import * as io from 'socket.io';
import * as path from 'path'
let sharedsession = require("express-socket.io-session");
import {GameServer} from "./server/GameServer";
import Socket = SocketIOClient.Socket;
import {CommonConfig, Origin} from "./Common/CommonConfig";

CommonConfig.ORIGIN = Origin.SERVER;
const port: number = process.env.PORT || 3000;

const app: express.Application = express();
const server: http.Server = http.createServer(app);
const session = express_session({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
});

server.listen(port);
console.log('Node gameServer started at ' + port);

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.get('/', (req, res) => {
    res.render('index');
});

app.use(session);

let sockets: SocketIO.Server = io.listen(server);
sockets.use(sharedsession(session));

let gameServer: GameServer = new GameServer(sockets);

gameServer.start();

/*this.socket.use((socket: SocketIO.Socket, next: Function) => {
    next();
});*/

//TODO find express-socket.io-session @types (sharedsession)