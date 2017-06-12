import {GameObject} from "./utils/game/GameObject";
import {GameObjectsHolder} from "./utils/game/GameObjectsHolder";

export class Game extends GameObjectsHolder{
    private tickrate: number = 30;
    private timeoutId: NodeJS.Timer;

    constructor() {
        super();
        console.log("create game instance");
    }

    public update(delta: number) {
        this.gameObjects.forEach((object: GameObject) => {
            object.update(delta);
        });
    }

    public stopGameLoop() {
        clearTimeout(this.timeoutId);
    }
}
