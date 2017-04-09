import Socket = SocketIOClient.Socket;
import Timer = NodeJS.Timer;

export class ServerClient {
    private name: string;
    private socket: Socket;
    private isReady: boolean;
    private lastHbInterval: number = 0;

    constructor(name: string, socket: Socket) {
        this.name = name;
        this.socket = socket;
        this.isReady = false;
    }

    get Name(): string {
        return this.name;
    }

    get Socket(): Socket {
        return this.socket;
    }

    get IsReady(): boolean {
        return this.isReady;
    }

    set IsReady(isReady: boolean) {
        this.isReady = isReady;
    }

    get LastHbInterval(): number {
        return this.lastHbInterval;
    }

    set LastHbInterval(value: number) {
        this.lastHbInterval = value;
    }
}