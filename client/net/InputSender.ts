import {SocketMsgs} from "../../shared/net/SocketMsgs";
import {InputSnapshot} from "../../shared/input/InputSnapshot";

export class InputSender {
    private socket: SocketIOClient.Socket;

    constructor(socket: SocketIOClient.Socket) {
        this.socket = socket;
    }

    public sendInput(snapshot: InputSnapshot) {
        let serializedSnapshot = snapshot.serializeSnapshot();
        //console.log(serializedSnapshot);
        if (serializedSnapshot.length > 0) {
            this.socket.emit(SocketMsgs.INPUT_SNAPSHOT, serializedSnapshot);
        }
    }
}