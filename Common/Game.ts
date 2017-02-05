export class Game {
    private tickrate: number = 60;
    private timeoutId: NodeJS.Timer;

    constructor() {
        console.log("create game instance");
    }

    public startGameLoop() {
        this.timeoutId = setTimeout(() => this.startGameLoop() , 1 / this.tickrate * 1000);
    }

    public stopGameLoop() {
        clearTimeout(this.timeoutId);
    }
}