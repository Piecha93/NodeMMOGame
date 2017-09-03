import {ChatHtmlHandler} from "./graphic/HtmlHandlers/ChatHtmlHandler";
import {SocketMsgs} from "../Common/net/SocketMsgs";

export class Chat {
    private socket: SocketIOClient.Socket;
    private chatHtmlHandler: ChatHtmlHandler;

    constructor(socket: SocketIOClient.Socket) {
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