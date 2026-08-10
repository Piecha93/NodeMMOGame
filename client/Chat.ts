import {ChatHtmlHandler} from "./graphic/HtmlHandlers/ChatHtmlHandler";
import {SocketMsgs} from "../shared/net/SocketMsgs";
import {Socket} from "socket.io-client";

export class Chat {
    private socket: Socket;
    private chatHtmlHandler: ChatHtmlHandler;

    constructor(socket: Socket) {
        this.socket = socket;

        this.socket.on(SocketMsgs.CHAT_MESSAGE, (data) => {
            this.chatHtmlHandler.append(data['s'], data['m']);
        });

        this.chatHtmlHandler = ChatHtmlHandler.Instance;
        this.chatHtmlHandler.setSubmitCallback(this.sendMessage.bind(this));
    }

    sendMessage(text: string) {
        this.socket.emit(SocketMsgs.CHAT_MESSAGE, text);
    }
}
