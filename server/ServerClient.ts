import * as SocketIO from 'socket.io';
import {ServerConfig} from "./ServerConfig";

export class ServerClient {
    private socket: SocketIO.Server;
    private name: string = "";
    private isReady: boolean = false;
    private lastHbTime: number = Date.now();
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

    get LastHbTime(): number {
        return this.lastHbTime;
    }

    set LastHbTime(value: number) {
        this.lastHbTime = value;
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