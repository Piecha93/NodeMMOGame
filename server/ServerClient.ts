import type { GameConnection } from "./transport/GameTransport";
import { ProtocolVersion } from "../shared/net/Protocol";

interface RateLimitWindow {
    startedAt: number;
    eventCount: number;
}

export class ServerClient {
    private socket: GameConnection;
    private userId: string;
    private name: string = "";
    private isReady: boolean = false;
    private isDisconnected: boolean = false;
    private protocolVersion: ProtocolVersion | null = null;
    private lastHbTime: number = Date.now();
    private playerId: string = "";
    private rateLimitWindows: Map<string, RateLimitWindow> = new Map<string, RateLimitWindow>();

    constructor(socket: GameConnection, userId: string) {
        this.socket = socket;
        this.userId = userId;
    }

    get Name(): string {
        return this.name;
    }

    get Socket(): GameConnection {
        return this.socket;
    }

    get UserId(): string {
        return this.userId;
    }

    get IsReady(): boolean {
        return this.isReady;
    }

    set IsReady(isReady: boolean) {
        this.isReady = isReady;
    }

    get IsDisconnected(): boolean {
        return this.isDisconnected;
    }

    set IsDisconnected(isDisconnected: boolean) {
        this.isDisconnected = isDisconnected;
    }

    get ProtocolVersion(): ProtocolVersion | null {
        return this.protocolVersion;
    }

    set ProtocolVersion(protocolVersion: ProtocolVersion | null) {
        this.protocolVersion = protocolVersion;
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

    public allowEvent(eventName: string, maxEvents: number, windowDuration: number, now: number = Date.now()): boolean {
        let rateLimitWindow = this.rateLimitWindows.get(eventName);

        if (!rateLimitWindow || now < rateLimitWindow.startedAt || now - rateLimitWindow.startedAt >= windowDuration) {
            rateLimitWindow = { startedAt: now, eventCount: 1 };
            this.rateLimitWindows.set(eventName, rateLimitWindow);
            return true;
        }

        if (rateLimitWindow.eventCount >= maxEvents) {
            return false;
        }

        rateLimitWindow.eventCount++;
        return true;
    }
}
