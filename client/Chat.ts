import { ChatHtmlHandler } from "./graphic/HtmlHandlers/ChatHtmlHandler";
import { SocketMsgs } from "../shared/net/SocketMsgs";
import { Socket } from "socket.io-client";

export class Chat {
    private readonly chatHtmlHandler: ChatHtmlHandler;
    private disposed = false;
    private readonly messageHandler = (data: unknown) => {
        if (this.disposed || typeof data !== "object" || data === null) return;
        const message = data as Record<string, unknown>;
        if (typeof message.s === "string" && typeof message.m === "string") {
            this.chatHtmlHandler.append(message.s, message.m);
        }
    };
    private readonly submitHandler = (text: string) => this.sendMessage(text);

    constructor(private readonly socket: Socket) {
        this.chatHtmlHandler = ChatHtmlHandler.Instance;
        this.chatHtmlHandler.setSubmitCallback(this.submitHandler);
        this.socket.on(SocketMsgs.CHAT_MESSAGE, this.messageHandler);
    }

    sendMessage(text: string): void {
        if (!this.disposed) this.socket.emit(SocketMsgs.CHAT_MESSAGE, text);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.socket.off(SocketMsgs.CHAT_MESSAGE, this.messageHandler);
        this.chatHtmlHandler.dispose();
    }
}
