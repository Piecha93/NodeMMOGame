import * as io from 'socket.io-client'

export class Client {
    socket: SocketIOClient.Socket;

    connect() {
        this.socket = io.connect();
        console.log('ddd');

        this.socket.on('dd', (data) => {
            console.log(data.name);
        });
    }
}