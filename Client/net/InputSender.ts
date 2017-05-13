import {SocketMsgs} from "../../Common/net/SocketMsgs";
import {InputSnapshot} from "../../Common/input/InputSnapshot";

export class InputSender {
    private socket: SocketIOClient.Socket;

    constructor(socket: SocketIOClient.Socket) {
        this.socket = socket;
    }

    public sendInput(id: number, snapshot: InputSnapshot) {
        let serializedSnapshot = snapshot.serializeSnapshot();
        //console.log(serializedSnapshot);
        if (serializedSnapshot.length > 0) {
            this.socket.emit(SocketMsgs.INPUT_SNAPSHOT, {id, serializedSnapshot});
        }
    }
}