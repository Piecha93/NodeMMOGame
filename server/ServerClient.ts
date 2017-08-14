import Socket = SocketIOClient.Socket;
import Timer = NodeJS.Timer;
import {ServerConfig} from "./ServerConfig";

export class ServerClient {
    private socket: Socket;
    private name: string = "";
    private isReady: boolean = false;
    private lastHbInterval: number = ServerConfig.CLIENT_TIMEOUT;
    private playerId: string = "";

    constructor(socket: Socket) {
        this.socket = socket;
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

    get PlayerId(): string {
        return this.playerId;
    }

    set PlayerId(value: string) {
        this.playerId = value;
    }
}