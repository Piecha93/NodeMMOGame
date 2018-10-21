export class DebugWindowHtmlHandler {
    private static instance: DebugWindowHtmlHandler;

    private debugWindowDiv: HTMLDivElement;
    readonly pingSpan: HTMLSpanElement;
    readonly fpsSpan: HTMLSpanElement;
    readonly gameObjectCounterSpan: HTMLSpanElement;
    readonly cursorObjectSpan: HTMLSpanElement;
    readonly positionSpan: HTMLSpanElement;

    private constructor() {
        this.debugWindowDiv = document.getElementById("debug-window") as HTMLDivElement;
        this.pingSpan = document.createElement("span");
        this.fpsSpan = document.createElement("span");
        this.gameObjectCounterSpan = document.createElement("span");
        this.cursorObjectSpan = document.createElement("span");
        this.positionSpan = document.createElement("span");

        this.Ping = "";
        this.Fps = "";
        this.GameObjectCounter = "0";
        this.CursorObjectSpan = "";
        this.Position = "0";

        this.debugWindowDiv.appendChild(this.pingSpan);
        this.debugWindowDiv.appendChild(this.fpsSpan);
        this.debugWindowDiv.appendChild(this.gameObjectCounterSpan);
        this.debugWindowDiv.appendChild(this.cursorObjectSpan);
        this.debugWindowDiv.appendChild(this.positionSpan);
    }

    static get Instance(): DebugWindowHtmlHandler {
        if(!DebugWindowHtmlHandler.instance) {
            DebugWindowHtmlHandler.instance = new DebugWindowHtmlHandler();
        }
        return DebugWindowHtmlHandler.instance;
    }

    set Ping(ping: string) {
        this.pingSpan.textContent = "Ping(ms):         " + ping;
    }

    set Fps(fps: string) {
        this.fpsSpan.innerHTML = "<br>" + "Fps: " + fps;
    }

    set GameObjectCounter(gameObjects: string) {
        this.gameObjectCounterSpan.innerHTML = "<br>" + "GameObjects: " + gameObjects;
    }

    set CursorObjectSpan(cursorObject: string) {
        this.cursorObjectSpan.innerHTML = "<br>" + "cursorObject: " + cursorObject;
    }

    set Position(position: string) {
        this.positionSpan.innerHTML = "<br>" + "Position: " + position;
    }
}