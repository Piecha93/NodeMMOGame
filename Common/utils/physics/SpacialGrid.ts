import {GameObject} from "../game/GameObject";
import {Transform} from "../game/Transform";
import {CommonConfig, Origin} from "../../CommonConfig";

export class Cell {
    objects: Array<GameObject> = new Array<GameObject>();
    transform: Transform;

    static ID = 0;

    id: number;

    constructor(transform: Transform) {
        this.id = Cell.ID++;
        this.transform = transform;
    }

    get Transform(): Transform {
        return this.transform;
    }

    addObject(gameObject: GameObject) {
            this.objects.push(gameObject);
    }

    clear() {
        this.objects.splice(0, this.objects.length);
    }

    isEmpty(): boolean {
        return this.objects.length <= 0;
    }

    checkCollisions() {
        for(let i = 0; i < this.objects.length; i++) {
            for(let j = i + 1; j < this.objects.length; j++) {
                let o1: GameObject = this.objects[i];
                let o2: GameObject = this.objects[j];
                if (o1 != o2 && Transform.testCollision(o1.Transform, o2.Transform)) {
                    o1.onCollisionEnter(o2);
                    o2.onCollisionEnter(o1);
                }
            }
        }
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

        this.gameObjects = new Array<GameObject>();
        this.cells = new Array<Cell>();

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
            let xs: number = gameObject.Transform.X / this.cellSize ;
            let xe: number = Math.floor(xs + (gameObject.Transform.Width / this.cellSize)) + 1;
            xs = Math.floor(xs) - 1;

            let ys: number = gameObject.Transform.Y / this.cellSize;
            let ye: number = Math.floor(ys + (gameObject.Transform.Height / this.cellSize)) + 1;
            ys = Math.floor(ys) - 1;

            for(let i = xs; i <= xe; i++) {
                if(i >= this.cellsX || i < 0) continue;
                for(let j = ys; j <= ye; j++) {
                    if(j >= this.cellsY || j < 0) continue;

                    let idx = (j * this.cellsX) + i;
                    if(Transform.testCollision(gameObject.Transform, this.cells[idx].Transform)) {
                        this.cells[idx].addObject(gameObject);
                    }
                }
            }

            // this.cells.forEach((cell: Cell) => {
            //     if(Transform.testCollision(gameObject.Transform, cell.Transform)) {
            //         cell.addObject(gameObject);
            //     }
            // });
        });
    }

    checkCollisions() {
        if(CommonConfig.ORIGIN == Origin.SERVER) {
            this.cells.forEach((cell: Cell) => {
                cell.checkCollisions();
            });
        }
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