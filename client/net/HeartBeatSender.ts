import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { DebugWindowHtmlHandler } from "../graphic/HtmlHandlers/DebugWindowHtmlHandler";
import { Socket } from "socket.io-client";

export class HeartBeatSender {
    private socket: Socket;
    private heartBeats: Map<number, number>;
    private hbId: number = 0;
    private interval: number = 1000;
    private isRunning = false;
    private heartbeatIntervalTimer: ReturnType<typeof setInterval> | null = null;
    private disposed = false;
    private readonly responseHandler = (id: number) => this.heartBeatResponse(id);

    constructor(socket: Socket, rate?: number) {
        this.socket = socket;
        this.socket.on(SocketMsgs.HEARTBEAT_RESPONSE, this.responseHandler);

        this.heartBeats = new Map<number, number>();

        if (rate != null) {
            this.interval = rate;
        }
    }

    private heartBeatResponse(id: number) {
        const sentAt = this.heartBeats.get(id);
        if (sentAt !== undefined) {
            let ping: number = Date.now() - sentAt;

            DebugWindowHtmlHandler.Instance.Ping = ping.toString();
            this.heartBeats.delete(id);
        }
    }

    public sendHeartBeat() {
        if (this.isRunning || this.disposed) {
            return;
        }

        this.isRunning = true;
        this.sendHeartbeatPacket();
        this.heartbeatIntervalTimer = setInterval(() => this.sendHeartbeatPacket(), this.interval);
    }

    public stopSendingHeartbeats() {
        this.isRunning = false;

        if (this.heartbeatIntervalTimer !== null) {
            clearInterval(this.heartbeatIntervalTimer);
            this.heartbeatIntervalTimer = null;
        }

        this.heartBeats.clear();
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.stopSendingHeartbeats();
        this.socket.off(SocketMsgs.HEARTBEAT_RESPONSE, this.responseHandler);
    }

    private sendHeartbeatPacket() {
        if (!this.isRunning) {
            return;
        }

        const now = Date.now();
        this.removeExpiredHeartbeats(now);

        this.socket.emit(SocketMsgs.HEARTBEAT, this.hbId);
        this.heartBeats.set(this.hbId, now);
        this.hbId++;
    }

    private removeExpiredHeartbeats(now: number) {
        const oldestHeartbeatToKeep = now - Math.max(this.interval * 5, 10000);

        this.heartBeats.forEach((sentAt: number, id: number) => {
            if (sentAt < oldestHeartbeatToKeep) {
                this.heartBeats.delete(id);
            }
        });
    }
}
