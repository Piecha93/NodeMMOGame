import * as express from 'express';
import * as http from 'http';
import * as io from 'socket.io';
import * as path from 'path'
import {GameServer} from "./server/GameServer";

const port: number = process.env.PORT || 3000;

const app: express.Application = express();
const server: http.Server = http.createServer(app);

server.listen(port);
console.log('Node gameServer started at ' + port);

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.get('/', (req, res) => {
    res.render('index');
});

let sockets: SocketIO.Server = io.listen(server);

let gameServer: GameServer = new GameServer(sockets);

gameServer.start();