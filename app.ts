import * as express from 'express';
import * as http from 'http';
import * as io from 'socket.io';
import * as path from 'path'

let port:number = process.env.PORT || 3000;

let app: any = express();
let server = http.createServer(app);

server.listen(port);
console.log('Node server started at ' + port);

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.get('/', (req, res) => {
    res.render('index');
});

var sockets = io.listen(server);

sockets.on('connection', (client) => {
    console.log("New Client connected");

    client.emit('dd', {name: 'asd'});
});


/*
app.get('/', (req, res) => {
    res.send('aaNO ELO ' + Math.random() * 5000);
});

app.listen(port, () => {
    console.log('suchom cie na 3000');
});*/