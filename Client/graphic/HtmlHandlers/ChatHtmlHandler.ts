export class ChatHtmlHandler {
    private static instance: ChatHtmlHandler;

    chatInput: HTMLInputElement;
    chatForm: HTMLFormElement;

    submitCallback: Function;

    private constructor() {
        this.create();
    }

    static get Instance(): ChatHtmlHandler {
        if(ChatHtmlHandler.instance) {
            return ChatHtmlHandler.instance;
        } else {
            ChatHtmlHandler.instance = new ChatHtmlHandler;
            return ChatHtmlHandler.instance;
        }
    }

    private create() {
        ChatHtmlHandler.instance = this;
        this.chatInput = document.getElementById("chat-input") as HTMLInputElement;
        this.chatForm = document.getElementById("chat-form") as HTMLFormElement;

        this.chatForm.onsubmit = () => {
            if(this.chatInput.value != "") {
                this.callSubmitCallback(this.chatInput.value);
                this.chatInput.value = "";
            }
            this.chatInput.blur();
            return false;
        };

        document.addEventListener("keypress", (event : KeyboardEvent) => {
            if(event.keyCode == 13) { //enter
                event.stopPropagation();
                this.chatInput.focus();
            }
        });

        this.chatInput.addEventListener("focusin", () => {
            //console.log("focusin" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 1)"
        });

        this.chatInput.addEventListener("focusout", () => {
            //console.log("focusout" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 0.1)"
        });

        let chatZone = document.getElementById("chat-zone") as HTMLDivElement;
        chatZone.addEventListener("mousedown", (event: MouseEvent) => {
            return false;
        });
    }

    private callSubmitCallback(text: string) {
        if(this.submitCallback) {
            this.submitCallback(text);
        }
    }

    public setSubmitCallback(submitCallback: Function) {
        this.submitCallback = submitCallback;
    }

    public append(sender: string, message: string) {
        let htmlMessageeSender: HTMLSpanElement = document.createElement("span") as HTMLSpanElement;
        htmlMessageeSender.innerHTML = "<b>" + sender + "</b>: ";
        htmlMessageeSender.style.color = "rgb(50, 50, 85)";

        let htmlMessageeContent: HTMLSpanElement = document.createElement("span") as HTMLSpanElement;
        htmlMessageeContent.textContent = message;
        htmlMessageeContent.style.color = "rgb(85, 85, 85)";

        let htmlMessagee: HTMLSpanElement = document.createElement("span") as HTMLSpanElement;
        htmlMessagee.id = "chat-msg";
        htmlMessagee.appendChild(htmlMessageeSender);
        htmlMessagee.appendChild(htmlMessageeContent);
        htmlMessagee.appendChild(document.createElement("br"));

        let messagesDiv: HTMLDivElement = document.getElementById("chat-msgs") as HTMLDivElement;
        messagesDiv.appendChild(htmlMessagee);
        if(messagesDiv.childNodes.length > 100) {
            messagesDiv.removeChild(messagesDiv.firstChild);
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}