

export class HeartBeatSender {
    private socket: SocketIOClient.Socket;
    private heartBeats: Map<number, number>;
    private timeoutId: NodeJS.Timer;
    private rate: number = 1;
    private hbId: number = 0;

    constructor(socket: SocketIOClient.Socket, rate?: number) {
        this.socket = socket;

        this.socket.on('hbr', this.heartBeatResponse.bind(this));

        this.heartBeats = new Map<number, number>();

        if(rate != null) {
            this.rate = rate;
        }
    }

    private heartBeatResponse(id: number) {
        let ping: number =  new Date().getTime() - this.heartBeats.get(id);
        console.log('hbr ' + ping);


    }

    public startSendingHeartbeats() {
        this.timeoutId = setTimeout(() => this.startSendingHeartbeats() , 1 / this.rate * 1000);

        this.socket.emit('hb', this.hbId);
        this.heartBeats.set(this.hbId, new Date().getTime());
        this.hbId++;
    }

    public stopSendingHeartbeats() {
        clearTimeout(this.timeoutId);
    }
}