import {Player} from "../game_utils/game/objects/Player";
import {GameObject} from "../game_utils/game/objects/GameObject";
import {Obstacle} from "../game_utils/game/objects/Obstacle";
import {ObjectsSerializer} from "../serialize/ObjectsSerializer";
import {SharedConfig} from "../SharedConfig";

let fs = require('fs');

function toArrayBuffer(buffer) {
    let ab = new ArrayBuffer(buffer.length);
    let view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}

export class Chunk {
    x: number;
    y: number;

    private size: number;

    readonly objects: Array<GameObject>;
    readonly neighbors: Array<Chunk>;
    private leavers: Array<GameObject>;

    private activateTriggers: number;

    private deactivatedTime: number;
    private isActive: boolean = false;

    private dumpedBuffer: ArrayBuffer = null;
    private isNextUpdateComplete: boolean = false;

    constructor(x: number, y: number, size: number) {
        this.x = x;
        this.y = y;
        this.size = size;

        this.objects = [];
        this.neighbors = [];
        this.leavers = [];
        this.activateTriggers = 0;

        if (SharedConfig.IS_SERVER) {
            this.deactivatedTime = -1;
        } else {
            this.deactivatedTime = -1;
        }
    }

    public addNeighbor(neighborChunk: Chunk) {
        this.neighbors.push(neighborChunk);
    }

    public addObject(gameObject: GameObject) {
        this.objects.push(gameObject);

        if (SharedConfig.IS_SERVER) {
            if (gameObject.IsChunkActivateTriger) {
                this.activateTriggers++;
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

        if (gameObject instanceof Player) {
            this.activateTriggers--;
            if (this.activateTriggers <= 0) {
                if (!this.HasPlayersInNeighborhood) {
                    this.deactivate();
                }
                this.deactivateNeighborsIfNoPlayers()
            }
        }
    }

    private activateNeighbors() {
        for (let i: number = 0; i < this.neighbors.length; i++) {
            this.neighbors[i].activate();
        }
    }

    private deactivateNeighborsIfNoPlayers() {
        for (let i: number = 0; i < this.neighbors.length; i++) {
            if (!this.neighbors[i].HasPlayersInNeighborhood) {
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
        if (this.hasObject(gameObject)) {
            return true;
        }

        for (let i: number = 0; i < this.neighbors.length; i++) {
            if (this.neighbors[i].hasObject(gameObject)) {
                return true;
            }
        }

        return false;
    }

    public activate() {
        this.deactivatedTime = -1;
        this.reload();
    }

    public deactivate() {
        if (this.IsDeactivateTimePassed && SharedConfig.IS_SERVER) {
            this.deactivatedTime = Date.now();
        }
    }

    public reload() {
        if (this.isActive) {
            return;
        }

        if (!this.dumpedBuffer) {
            let fileName: string = "data/" + this.x + "." + this.y + ".chunk";
            try {
                let buffer: Buffer = fs.readFileSync(fileName);
                this.dumpedBuffer = toArrayBuffer(buffer);
            } catch (e) {
                console.log("no data file found");
            }
        }

        if (this.dumpedBuffer) {
            ObjectsSerializer.deserializeChunk(this.dumpedBuffer);
        }

        this.dumpedBuffer = null;
        this.isActive = true;
    }

    public dumpToMemory() {
        if (this.dumpedBuffer || !this.isActive) {
            return;
        }

        this.clearNotObstacles();

        this.dumpedBuffer = ObjectsSerializer.serializeChunk(this);

        let fileName: string = "data/" + this.x + "." + this.y + ".chunk";
        fs.writeFile(fileName, new Buffer(this.dumpedBuffer), () => {});

        this.clearAll();
        this.isActive = false;
    }

    public clearAll() {
        while (this.objects.length > 0) {
            this.objects[0].destroy();
        }
    }

    private clearNotObstacles() {
        let numOfObjectsToBeSaved: number = 0;
        while (this.objects.length > numOfObjectsToBeSaved) {
            if (!(this.objects[numOfObjectsToBeSaved] instanceof Obstacle)) {
                this.objects[numOfObjectsToBeSaved].destroy();
            } else {
                numOfObjectsToBeSaved++;
            }
        }
    }

    get IsNextUpdateComplete(): boolean {
        return this.isNextUpdateComplete;
    }

    set IsNextUpdateComplete(isNextUpdateComplete: boolean) {
        this.isNextUpdateComplete = isNextUpdateComplete;
    }

    get Objects(): Array<GameObject> {
        return this.objects;
    }

    get HasPlayers(): boolean {
        return this.activateTriggers > 0;
    }

    get HasPlayersInNeighborhood(): boolean {
        if (this.HasPlayers) {
            return true;
        }

        for (let i: number = 0; i < this.neighbors.length; i++) {
            if (this.neighbors[i].HasPlayers) {
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
        return this.isActive;
    }

    get IsDeactivateTimePassed(): boolean {
        return this.deactivatedTime == -1 || this.TimeSinceDeactivation < SharedConfig.chunkDeactivationTime;
    }

    get TimeSinceDeactivation(): number {
        return Date.now() - this.deactivatedTime;
    }
}