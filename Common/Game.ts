import {Player} from "./utils/Player";
import {Position} from "./utils/Position";

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

        // this.players.forEach((player: Player, key: string) => {
        //     player.Position.X +=  Math.floor(Math.random() * 3) - 1;
        //     player.Position.Y +=  Math.floor(Math.random() * 3) - 1;
        // });

        this.players.forEach((player: Player, key: string) => {
            if(player.Destination != null) {
                player.Position.X += (player.Destination.X - player.Position.X) / 10;
                player.Position.Y += (player.Destination.Y - player.Position.Y) / 10;

              //  player.Destination = null;
            }
        });
    }

    public stopGameLoop() {
        clearTimeout(this.timeoutId);
    }

    public spawnPlayer(name: string, position?: Position): Player {
        if(this.players.has(name)) {
            return this.players.get(name);
        }

        let player: Player;
        if(!position) {
            position = new Position(0,0);
        }

        player = new Player(name, position);

        this.players.set(name, player);

        //console.log("New player " + name);
        //console.log("Number of players " + this.players.size);

        return player;
    }

    public getPlayer(name: string): Player {
        return this.players.get(name);
    }
}
