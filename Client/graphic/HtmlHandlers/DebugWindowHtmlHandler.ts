export class DebugWindowHtmlHandler {
    private static instance: DebugWindowHtmlHandler;

    private debugWindowDiv: HTMLDivElement;
    private pingSpan: HTMLSpanElement;
    private fpsSpan: HTMLSpanElement;

    private constructor() {
        this.debugWindowDiv = document.getElementById("debug-window") as HTMLDivElement;
        this.pingSpan = document.createElement("span");
        this.fpsSpan = document.createElement("span");

        this.Ping = "";
        this.Fps = "";

        this.debugWindowDiv.appendChild(this.pingSpan);
        this.debugWindowDiv.appendChild(this.fpsSpan);
    }

    static get Instance(): DebugWindowHtmlHandler {
        if(DebugWindowHtmlHandler.instance) {
            return DebugWindowHtmlHandler.instance;
        } else {
            DebugWindowHtmlHandler.instance = new DebugWindowHtmlHandler;
            return DebugWindowHtmlHandler.instance;
        }
    }

    set Ping(ping: string) {
        this.pingSpan.textContent = "Ping(ms): " + ping;
    }

    set Fps(fps: string) {
        this.fpsSpan.innerHTML = "<br>" + "Fps: " + fps;
    }
}