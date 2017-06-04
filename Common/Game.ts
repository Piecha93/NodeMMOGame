import {GameObject} from "./utils/GameObject";
import {GameObjectsHolder} from "./utils/GameObjectsHolder";

export class Game extends GameObjectsHolder{
    private tickrate: number = 30;
    private timeoutId: NodeJS.Timer;

    constructor() {
        super();
        console.log("create game instance");
    }

    public startGameLoop() {
        this.timeoutId = setTimeout(() => this.startGameLoop() , 1 / this.tickrate * 1000);

        this.gameObjects.forEach((object: GameObject) => {
            object.update();
        });
    }

    public stopGameLoop() {
        clearTimeout(this.timeoutId);
    }
}
