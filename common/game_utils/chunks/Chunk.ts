import {Player} from "../game/objects/Player";
import {GameObject} from "../game/objects/GameObject";
import {Obstacle} from "../game/objects/Obstacle";
import {ObjectsSerializer} from "../../serialize/ObjectsSerializer";
import {CommonConfig} from "../../CommonConfig";

export class Chunk {
    x: number;
    y: number;

    private size: number;

    readonly objects: Array<GameObject>;
    readonly neighbors: Array<Chunk>;
    private leavers: Array<GameObject>;

    private numOfPlayers: number;
    private hasNewcomers: boolean = false;

    private deactivatedTime: number = -1;

    private dumpedBuffer: ArrayBuffer = null;

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
            if(CommonConfig.IS_SERVER) {
                this.activate();
                this.activateNeighbors();
            }
        }
    }

    public removeObject(gameObject: GameObject) {
        let index: number = this.objects.indexOf(gameObject, 0);
        if (index > -1) {
            this.objects.splice(index, 1);
        }

        if(gameObject instanceof Player) {
            this.numOfPlayers--;
            if(this.numOfPlayers <= 0) {
                if(!this.HasPlayersInNeighborhood) {
                    this.deactivate();
                }
                this.deactivateNeighborsIfNoPlayers()
            }
        }
    }

    private activateNeighbors() {
        for(let i: number = 0; i < this.neighbors.length; i++) {
            this.neighbors[i].activate();
        }
    }

    private deactivateNeighborsIfNoPlayers() {
        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(!this.neighbors[i].HasPlayersInNeighborhood) {
                this.neighbors[i].deactivate();
            }
        }
    }

    public addLeaver(gameObject: GameObject) {
        this.leavers.push(gameObject);
    }

    public resetLeavers() {
        this.leavers = [];
    }

    public hasObject(gameObject: GameObject): boolean {
        return this.objects.indexOf(gameObject) != -1;
    }

    public hasObjectInNeighborhood(gameObject: GameObject): boolean {
        if(this.hasObject(gameObject)) {
            return true;
        }

        for(let i: number = 0; i < this.neighbors.length; i++) {
            if(this.neighbors[i].hasObject(gameObject)) {
                return true;
            }
        }

        return false;
    }

    public resetHasNewComers() {
        this.hasNewcomers = false;
    }

    public activate() {
        this.deactivatedTime = -1;
        this.reload();
    }

    public deactivate() {
        if(this.IsActive && CommonConfig.IS_SERVER) {
            this.deactivatedTime = Date.now();
        }
    }

    public reload() {
        if(this.dumpedBuffer) {
            ObjectsSerializer.deserializeChunk(this.dumpedBuffer);
            this.dumpedBuffer = null;
        }
    }

    public dump() {
        if(this.dumpedBuffer) {
            return;
        }

        this.clearNotObstacles();
        this.dumpedBuffer = ObjectsSerializer.serializeChunk(this);
        this.clearAll();
    }

    private clearAll() {
        while (this.objects.length > 0) {
            this.objects[0].destroy();
        }
    }

    private clearNotObstacles() {
        let numOfObjectsToBeSaved: number = 0;
        while(this.objects.length > numOfObjectsToBeSaved) {
            if(!(this.objects[numOfObjectsToBeSaved] instanceof Obstacle)) {
                this.objects[numOfObjectsToBeSaved].destroy();
            } else {
                numOfObjectsToBeSaved++;
            }
        }
    }

    get Objects(): Array<GameObject> {
        return this.objects;
    }

    get HasNewcomers(): boolean {
        return this.hasNewcomers;
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

    get IsActive(): boolean {
        return this.deactivatedTime == -1 || this.TimeSinceDeactivation < CommonConfig.chunkDeactivationTime;
    }

    get TimeSinceDeactivation(): number {
        return Date.now() - this.deactivatedTime;
    }
}