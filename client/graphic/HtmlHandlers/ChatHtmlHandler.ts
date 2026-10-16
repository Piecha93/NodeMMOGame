export class ChatHtmlHandler {
    private static instance: ChatHtmlHandler | undefined;
    readonly chatInput: HTMLInputElement;
    readonly chatForm: HTMLFormElement;
    private readonly messagesDiv: HTMLDivElement;
    private submitCallback: ((text: string) => void) | null = null;
    private disposed = false;
    private readonly submitHandler = (event: Event) => {
        event.preventDefault();
        if (this.chatInput.value !== "") {
            this.submitCallback?.(this.chatInput.value);
            this.chatInput.value = "";
        }
        this.chatInput.blur();
    };
    private readonly keyHandler = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            const target = event.target as HTMLElement | null;
            if (
                target !== this.chatInput &&
                typeof target?.closest === "function" &&
                target.closest("button, a, input, textarea, select, form, [contenteditable]")
            )
                return;
            event.stopPropagation();
            if (document.activeElement !== this.chatInput) {
                // The opening Enter must not also submit the newly focused form.
                event.preventDefault();
                this.chatInput.focus();
            }
        }
    };
    private readonly focusHandler = () => {
        this.chatInput.style.color = "#f1e6d4";
    };
    private readonly blurHandler = () => {
        this.chatInput.style.color = "#b4b8b0";
    };

    private constructor() {
        const input = document.getElementById("chat-input");
        const form = document.getElementById("chat-form");
        const messages = document.getElementById("chat-msgs");
        if (
            !(input instanceof HTMLInputElement) ||
            !(form instanceof HTMLFormElement) ||
            !(messages instanceof HTMLDivElement)
        ) {
            throw new Error("Cannot initialize chat: required chat elements are missing");
        }
        this.chatInput = input;
        this.chatForm = form;
        this.messagesDiv = messages;
        this.chatForm.addEventListener("submit", this.submitHandler);
        document.addEventListener("keydown", this.keyHandler);
        this.chatInput.addEventListener("focusin", this.focusHandler);
        this.chatInput.addEventListener("focusout", this.blurHandler);
    }

    static get Instance(): ChatHtmlHandler {
        return (ChatHtmlHandler.instance ??= new ChatHtmlHandler());
    }

    public setSubmitCallback(callback: (text: string) => void): void {
        this.submitCallback = callback;
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.chatForm.removeEventListener("submit", this.submitHandler);
        document.removeEventListener("keydown", this.keyHandler);
        this.chatInput.removeEventListener("focusin", this.focusHandler);
        this.chatInput.removeEventListener("focusout", this.blurHandler);
        this.submitCallback = null;
        if (ChatHtmlHandler.instance === this) ChatHtmlHandler.instance = undefined;
    }

    public append(sender: string, message: string): void {
        if (this.disposed) return;
        const author = document.createElement("b");
        author.textContent = sender;
        const content = document.createElement("span");
        content.textContent = message;
        const row = document.createElement("span");
        row.appendChild(author);
        row.appendChild(document.createTextNode(": "));
        row.appendChild(content);
        row.appendChild(document.createElement("br"));
        this.messagesDiv.appendChild(row);
        const first = this.messagesDiv.firstChild;
        if (this.messagesDiv.childNodes.length > 100 && first) this.messagesDiv.removeChild(first);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }
}
