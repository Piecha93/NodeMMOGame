import * as SocketIO from 'socket.io';
import {ServerConfig} from "./ServerConfig";

export class ServerClient {
    private socket: SocketIO.Server;
    private name: string = "";
    private isReady: boolean = false;
    private lastHbInterval: number = ServerConfig.CLIENT_TIMEOUT;
    private playerId: string = "";

    constructor(socket: SocketIO.Server) {
        this.socket = socket;
    }

    get Name(): string {
        return this.name;
    }

    get Socket(): SocketIO.Server {
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

    set Name(value: string) {
        this.name = value;
    }
}