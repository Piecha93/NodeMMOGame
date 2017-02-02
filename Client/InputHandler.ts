
export class InputHandler {
    constructor() {
        document.addEventListener("keydown", this.keyPressed);
        document.addEventListener("keyup", this.keyReleased);
        console.log("InputHandler");
    }

    private keyPressed(event : KeyboardEvent) {
        console.log(event.keyCode);
    }

    private keyReleased(event : KeyboardEvent) {
        console.log(event.keyCode);
    }
}