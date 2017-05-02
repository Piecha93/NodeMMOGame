export class ChatHtmlHandler {
    constructor(submitCallback: Function) {
        let chatInput: HTMLInputElement = document.getElementById("chat-input") as HTMLInputElement;
        let chatForm: HTMLFormElement = document.getElementById("chat-form") as HTMLFormElement;

        let stopNextSubmit: boolean = false;
        chatInput.style.display = 'none';
        chatForm.onsubmit = () => {
            if(chatInput.value != "") {
                submitCallback(chatInput.value);
                chatInput.value = "";
            }
            chatInput.style.display = 'none';

            return false;
        };

        document.addEventListener("keypress", (event : KeyboardEvent) => {
            if(event.keyCode == 13) { //enter
                event.stopPropagation();
                stopNextSubmit = true;
                chatInput.style.display = '';
                chatInput.focus();
            }
        });
    }

    public append(sender: string, message: string) {
        //let htmlMessage = "<div class='chatmsg'>" + message + "</div>";
        let htmlMessagee: HTMLDivElement = document.createElement("div") as HTMLDivElement;
        htmlMessagee.innerHTML = "<b>" + sender + "</b>: " + message; //TODO prevent user from append html tags in message
        htmlMessagee.id = "chat-msg";
        let messagesDiv: HTMLDivElement = document.getElementById("chat-msgs") as HTMLDivElement;
        messagesDiv.appendChild(htmlMessagee);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}