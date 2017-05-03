

import {SocketMsgs} from "../Common/net/SocketMsgs";
export class HeartBeatSender {
    private socket: SocketIOClient.Socket;
    private heartBeats: Map<number, number>;
    private hbId: number = 0;
    private rate: number = 1;
    private isRunning = false;

    constructor(socket: SocketIOClient.Socket, rate?: number) {
        this.socket = socket;

        this.socket.on(SocketMsgs.HEARTBEAT_RESPONSE, this.heartBeatResponse.bind(this));

        this.heartBeats = new Map<number, number>();

        if(rate != null) {
            this.rate = rate;
        }
    }

    private heartBeatResponse(id: number) {
        let ping: number =  new Date().getTime() - this.heartBeats.get(id);
        //console.log('hbr ' + ping);
        if(this.isRunning) {
            setTimeout(() => this.startSendingHeartbeats(), 1 / this.rate * 1000);
        }
    }

    public startSendingHeartbeats() {
        this.isRunning = true;
        this.socket.emit(SocketMsgs.HEARTBEAT, this.hbId);
        this.heartBeats.set(this.hbId, new Date().getTime());
        this.hbId++;
    }

    public stopSendingHeartbeats() {
        this.isRunning = true;
    }
}