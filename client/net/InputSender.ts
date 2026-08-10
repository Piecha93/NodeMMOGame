import {SocketMsgs} from "../../shared/net/SocketMsgs";
import {InputSnapshot} from "../../shared/input/InputSnapshot";
import {Socket} from "socket.io-client";

export class InputSender {
    private socket: Socket;

    constructor(socket: Socket) {
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
