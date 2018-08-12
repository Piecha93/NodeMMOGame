import {SocketMsgs} from "../../common/net/SocketMsgs";
import {DebugWindowHtmlHandler} from "../graphic/HtmlHandlers/DebugWindowHtmlHandler";

export class HeartBeatSender {
    private socket: SocketIOClient.Socket;
    private heartBeats: Map<number, number>;
    private hbId: number = 0;
    private interval: number = 1000;
    private isRunning = false;

    constructor(socket: SocketIOClient.Socket, rate?: number) {
        this.socket = socket;
        this.socket.on(SocketMsgs.HEARTBEAT_RESPONSE, this.heartBeatResponse.bind(this));

        this.heartBeats = new Map<number, number>();

        if(rate != null) {
            this.interval = rate;
        }
    }

    private heartBeatResponse(id: number) {
        if (this.heartBeats.has(id)) {
            let ping: number = new Date().getTime() - this.heartBeats.get(id);

            DebugWindowHtmlHandler.Instance.Ping = ping.toString();

            if (this.isRunning) {
                setTimeout(() => this.sendHeartBeat(), this.interval);
            }
            this.heartBeats.delete(id);
        }
    }

    public sendHeartBeat() {
        this.isRunning = true;
        this.socket.emit(SocketMsgs.HEARTBEAT, this.hbId);
        this.heartBeats.set(this.hbId, new Date().getTime());
        this.hbId++;
    }

    public stopSendingHeartbeats() {
        this.isRunning = false;
    }
}