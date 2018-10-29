import {Polygon, Circle} from "detect-collisions";
import {Size, Vector2} from "./Transform";
import {GameObject} from "../game/objects/GameObject";

export class Collider {
    private shape: Polygon | Circle;

    private width: number;
    private height: number;
    private parent: GameObject;
    private angle = 0;

    private isActive = true;

    constructor(parent: GameObject, size?: Size) {
        this.parent = parent;
        let x: number = parent.Transform.X;
        let y: number = parent.Transform.Y;

        let isCircle: boolean = false;

        if(!size) {
            this.width = 32;
            this.height = 32;
        }
        else if(size instanceof Array) {
            this.width = size[0];
            this.height = size[1];
        } else {
            this.width = size;
            this.height = size;
            isCircle = true;
        }

        if(isCircle) {
            this.shape = new Circle(x, y, this.width);
        } else {
            let w: number = this.width / 2;
            let h: number = this.height / 2;

            this.shape = new Polygon(x, y, [[-w, -h], [w, -h], [w, h], [-w, h]]);
        }
    }

    public update() {
        this.shape.x = this.parent.Transform.X;
        this.shape.y = this.parent.Transform.Y;
    }

    get IsActive(): boolean {
        return this.isActive;
    }

    set IsActive(isActive: boolean) {
        this.isActive = isActive;
    }
}