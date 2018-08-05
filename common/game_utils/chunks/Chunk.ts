import {Player} from "../game/objects/Player";
import {GameObject} from "../game/objects/GameObject";

export class Chunk {
    x: number;
    y: number;

    private size: number;

    readonly objects: Array<GameObject>;
    readonly neighbors: Array<Chunk>;
    private leavers: Array<GameObject>;

    private numOfPlayers: number;
    private hasNewcomers: boolean = false;

    constructor(x: number, y: number, size: number) {
        this.x = x;
        this.y = y;
        this.size = size;

        this.objects = [];
        this.neighbors = [];
        this.leavers = [];
        this.numOfPlayers = 0;
    }

    public addNeighbor(neighborChunk: Chunk) {
        this.neighbors.push(neighborChunk);
    }

    public addObject(gameObject: GameObject) {
        this.objects.push(gameObject);

        if(gameObject instanceof Player) {
            this.hasNewcomers = true;
            this.numOfPlayers++;
        }
    }

    public addLeaver(gameObject: GameObject) {
        this.leavers.push(gameObject);
    }

    public resetLeavers() {
        this.leavers = [];
    }

    public removeObject(gameObject: GameObject) {
        let index: number = this.objects.indexOf(gameObject, 0);
        if (index > -1) {
            this.objects.splice(index, 1);
        }

        if(gameObject instanceof Player) {
            this.numOfPlayers--;
        }
    }

    public hasObjectInside(gameObject: GameObject): boolean {
        return this.objects.indexOf(gameObject) != -1;
    }

    public hasObjectInNeighborhood(gameObject: GameObject): boolean {
        if(this.hasObjectInside(gameObject)) {
            return true;
        }

        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(this.neighbors[i].hasObjectInside(gameObject)) {
                return true;
            }
        }

        return false;
    }

    get Objects(): Array<GameObject> {
        return this.objects;
    }

    get HasNewcomers(): boolean {
        return this.hasNewcomers;
    }

    resetHasNewComers() {
        this.hasNewcomers = false;
    }

    get HasNewcomersInNeighborhood(): boolean {
        if(this.HasNewcomers) {
            return true;
        }

        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(this.neighbors[i].HasNewcomers) {
                return true;
            }
        }

        return false;
    }

    get HasPlayers(): boolean {
        return this.numOfPlayers > 0;
    }

    get HasPlayersInNeighborhood(): boolean {
        if(this.HasPlayers) {
            return true;
        }

        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(this.neighbors[i].HasPlayers) {
                return true;
            }
        }

        return false;
    }

    get Neighbors(): Array<Chunk> {
        return this.neighbors;
    }

    get Leavers(): Array<GameObject> {
        return this.leavers;
    }
}