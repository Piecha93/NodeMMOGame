export class ChatHtmlHandler {
    chatInput: HTMLInputElement;
    chatForm: HTMLFormElement;

    constructor(submitCallback: Function) {
        this.chatInput = document.getElementById("chat-input") as HTMLInputElement;
        this.chatForm = document.getElementById("chat-form") as HTMLFormElement;

        this.chatForm.onsubmit = () => {
            if(this.chatInput.value != "") {
                submitCallback(this.chatInput.value);
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
            console.log("focusin" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 1)"
        });

        this.chatInput.addEventListener("focusout", () => {
            console.log("focusout" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 0.1)"
        });

        let chatZone = document.getElementById("chat-zone") as HTMLDivElement;
        chatZone.addEventListener("mousedown", (event: MouseEvent) => {
            return false;
        });
    }

    public append(sender: string, message: string) {
        //let htmlMessage = "<div class='chatmsg'>" + message + "</div>";

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