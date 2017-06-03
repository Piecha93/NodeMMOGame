import {Player} from "./utils/Player";
import {Position} from "./utils/Position";
import {GameObject} from "./utils/GameObject";

export class Game {
    private tickrate: number = 30;
    private timeoutId: NodeJS.Timer;
    private objects: Map<number, GameObject>;

    constructor() {
        this.objects = new Map<number, GameObject>();
        console.log("create game instance");
    }

    public startGameLoop() {
        this.timeoutId = setTimeout(() => this.startGameLoop() , 1 / this.tickrate * 1000);

        this.objects.forEach((object: GameObject) => {
            object.update();
        });
    }

    public stopGameLoop() {
        clearTimeout(this.timeoutId);
    }

    public spawnPlayer(name: string, position: Position): Player {
        let player: Player;

        player = new Player(name, position);

        console.log("player id " + player.ID);
        this.objects.set(player.ID, player);

        //console.log("New player " + name);
        //console.log("Number of objects " + this.objects.size);

        return player;
    }

    public addGameObject(gameObject: GameObject) {
        this.objects.set(gameObject.ID, gameObject);
    }

    public removeGameObject(id: number) {
        this.objects.delete(id);
    }

    public getObject(id: number): GameObject {
        return this.objects.get(id);
    }
}
