import Socket = SocketIOClient.Socket;

export class ServerClient {
    private name: string;
    private socket: Socket;

    constructor(name: string, socket: Socket) {
        this.name = name;
        this.socket = socket;

    }

    public getSocket(): Socket {
        return this.socket;
    }
}