import {Transform} from "./Transform";
import * as SAT from 'sat';
import {Collidable} from "./Collidable";

export class Cell {
    private objects: Array<Collidable> = [];
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

    addObject(collidable: Collidable) {
        if(this.objects.indexOf(collidable) == -1) {
            this.objects.push(collidable);
        }
    }

    removeObject(collidable: Collidable) {
        let index: number = this.objects.indexOf(collidable, 0);
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

    checkCollisionsForObject(o1: Collidable) {
        if (this.objects.indexOf(o1) == -1) {
            return;
        }
        for (let i = 0; i < this.objects.length; i++) {
            let o2: Collidable = this.objects[i];

            if(this.checkCollision(o1, o2)) {
                o1.onCollisionEnter(o2, this.response);
            }
        }
    }

    checkCollisions() {
        for(let i = 0; i < this.objects.length; i++) {
            for(let j = i + 1; j < this.objects.length; j++) {
                let o1: Collidable = this.objects[i];
                let o2: Collidable = this.objects[j];

                if(this.checkCollision(o1, o2)) {
                    o1.onCollisionEnter(o2, this.response);
                    o2.onCollisionEnter(o1, this.response);
                }
            }
        }
    }

    checkCollision(o1: Collidable, o2: Collidable): boolean {
        this.response.clear();
        return o1 != o2 && Transform.testCollision(o1.Transform, o2.Transform, this.response);
    }
}

export class SpatialGrid {
    width: number;
    height: number;
    cellSize: number;

    private cells: Array<Cell>;
    private arrayCollidable: Array<Collidable>;

    private cellsX: number;
    private cellsY: number;

    constructor(width: number, height: number, cellSize: number) {
        this.width = width;
        this.height = height;

        this.cellSize = cellSize;

        this.cellsX = Math.ceil(width / cellSize);
        this.cellsY = Math.ceil(height / cellSize);

        this.arrayCollidable = [];
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
        this.arrayCollidable.forEach((collidable: Collidable) => {
            this.insertObject(collidable);
        });
    }

    public insertObject(collidable: Collidable) {
        collidable.spatialGridCells.forEach((cell: Cell) => {
           cell.removeObject(collidable);
        });
        let xs: number = collidable.Transform.X / this.cellSize - 1;
        let xe: number = Math.floor(xs + (collidable.Transform.Width / this.cellSize)) + 2;
        xs = Math.floor(xs);

        let ys: number = collidable.Transform.Y / this.cellSize - 1;
        let ye: number = Math.floor(ys + (collidable.Transform.Height / this.cellSize)) + 2;
        ys = Math.floor(ys);

        let cells: Array<Cell> = [];

        for(let i = xs; i <= xe; i++) {
            if(i >= this.cellsX || i < 0) continue;
            for(let j = ys; j <= ye; j++) {
                if(j >= this.cellsY || j < 0) continue;

                let idx = (j * this.cellsX) + i;
                if(Transform.testCollision(collidable.Transform, this.cells[idx].Transform)) {
                    this.cells[idx].addObject(collidable);
                    cells.push(this.cells[idx]);
                }
            }
        }
        collidable.spatialGridCells = cells;
    }

    checkCollisions() {
        this.cells.forEach((cell: Cell) => {
            cell.checkCollisions();
        });
    }

    addObject(collidable: Collidable) {
        this.arrayCollidable.push(collidable);
    }

    removeObject(collidable: Collidable) {
        if(this.arrayCollidable.indexOf(collidable) != -1) {
            this.arrayCollidable.splice(this.arrayCollidable.indexOf(collidable), 1);
        }
    }

    get Cells(): Array<Cell> {
        return this.cells;
    }
}