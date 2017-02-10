import {Player} from "../Client/utils/Player";
import {Position} from "../Client/utils/Position";

export class Game {
    private tickrate: number = 60;
    private timeoutId: NodeJS.Timer;
    private players: Map<string, Player>;

    constructor() {
        this.players = new Map<string, Player>();
        console.log("create game instance");
    }

    public startGameLoop() {
        this.timeoutId = setTimeout(() => this.startGameLoop() , 1 / this.tickrate * 1000);
    }

    public stopGameLoop() {
        clearTimeout(this.timeoutId);
    }

    public addPlayer(name: string, position?: Position): Player {
        let player: Player;
        if(position) {
            player = new Player(name, position);
        } else {
            player = new Player(name);
        }

        this.players.set(name, player);

        console.log("New player " + name);
        console.log("Number of players " + this.players.size);

        return player;
    }
}
