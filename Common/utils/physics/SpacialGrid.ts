import {GameObject} from "../game/GameObject";
import {Transform} from "./Transform";
import * as SAT from 'sat';

export class Cell {
    private objects: Array<GameObject> = [];
    private transform: Transform;
    private response: SAT.Response;

    static ID = 0;

    id: number;

    constructor(transform: Transform) {
        this.id = Cell.ID++;
        this.transform = transform;
        this.response = new SAT.Response();
    }

    get Transform(): Transform {
        return this.transform;
    }

    addObject(gameObject: GameObject) {
        if(this.objects.indexOf(gameObject) == -1) {
            this.objects.push(gameObject);
        }
    }

    removeObject(gameObject: GameObject) {
        let index: number = this.objects.indexOf(gameObject, 0);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }

    clear() {
        this.objects.splice(0, this.objects.length);
    }

    isEmpty(): boolean {
        return this.objects.length <= 0;
    }

    checkCollisionsForObject(o1: GameObject) {
        if (this.objects.indexOf(o1) == -1) {
            return;
        }
        for (let i = 0; i < this.objects.length; i++) {
            let o2: GameObject = this.objects[i];

            if(this.checkCollision(o1, o2)) {
                o1.onCollisionEnter(o2, this.response);
            }
        }
    }

    checkCollisions() {
        for(let i = 0; i < this.objects.length; i++) {
            for(let j = i + 1; j < this.objects.length; j++) {
                let o1: GameObject = this.objects[i];
                let o2: GameObject = this.objects[j];

                if(this.checkCollision(o1, o2)) {
                    o1.onCollisionEnter(o2, this.response);
                    o2.onCollisionEnter(o1, this.response);
                }
            }
        }
    }

    checkCollision(o1: GameObject, o2: GameObject): boolean {
        this.response.clear();
        return o1 != o2 && Transform.testCollision(o1.Transform, o2.Transform, this.response);
    }
}

export class SpacialGrid {
    width: number;
    height: number;
    cellSize: number;

    private cells: Array<Cell>;
    private gameObjects: Array<GameObject>;

    private cellsX: number;
    private cellsY: number;

    constructor(width: number, height: number, cellSize: number) {
        this.width = width;
        this.height = height;

        this.cellSize = cellSize;

        this.cellsX = Math.ceil(width / cellSize);
        this.cellsY = Math.ceil(height / cellSize);

        this.gameObjects = [];
        this.cells = [];

        for(let y: number = 0; y < this.cellsY; y++) {
            for(let x: number = 0; x < this.cellsX; x++) {
                let transform: Transform = new Transform(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                let cell: Cell = new Cell(transform);
                this.cells.push(cell);
            }
        }
    }

    public rebuildGrid() {
        this.cells.forEach((cell: Cell) => {
            cell.clear();
        });
        this.gameObjects.forEach((gameObject: GameObject) => {
            this.insertObjectIntoGrid(gameObject);
        });
    }

    public insertObjectIntoGrid(gameObject: GameObject) {
        gameObject.spacialGridCells.forEach((cell: Cell) => {
           cell.removeObject(gameObject);
        });
        let xs: number = gameObject.Transform.X / this.cellSize ;
        let xe: number = Math.floor(xs + (gameObject.Transform.Width / this.cellSize)) + 1;
        xs = Math.floor(xs);

        let ys: number = gameObject.Transform.Y / this.cellSize;
        let ye: number = Math.floor(ys + (gameObject.Transform.Height / this.cellSize)) + 1;
        ys = Math.floor(ys);

        let cells: Array<Cell> = [];

        for(let i = xs; i <= xe; i++) {
            if(i >= this.cellsX || i < 0) continue;
            for(let j = ys; j <= ye; j++) {
                if(j >= this.cellsY || j < 0) continue;

                let idx = (j * this.cellsX) + i;
                if(Transform.testCollision(gameObject.Transform, this.cells[idx].Transform)) {
                    this.cells[idx].addObject(gameObject);
                    cells.push(this.cells[idx]);
                }
            }
        }
        gameObject.spacialGridCells = cells;
        //TODO this is workaround for enemy outside map
        if(cells.length == 0) {
            gameObject.destroy();
        }
    }

    checkCollisions() {
        this.cells.forEach((cell: Cell) => {
            cell.checkCollisions();
        });
    }

    addObject(gameObject: GameObject) {
        this.gameObjects.push(gameObject);
    }

    removeObject(gameObject: GameObject) {
        if(this.gameObjects.indexOf(gameObject) != -1) {
            this.gameObjects.splice(this.gameObjects.indexOf(gameObject), 1);
        }
    }

    get Cells(): Array<Cell> {
        return this.cells;
    }
}