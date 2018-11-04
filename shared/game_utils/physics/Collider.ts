import {Polygon, Circle, Body, Result} from "detect-collisions";
import {Size, Vector2} from "./Transform";
import {GameObject} from "../game/objects/GameObject";
import {Collision} from "./Collision";


export class Collider {
    private shape: Polygon | Circle;

    private width: number;
    private height: number;
    private parent: GameObject;
    private rotation = 0;

    private offsetX: number;
    private offsetY: number;

    //TODO use isActive!
    private isActive: boolean = true;
    private isTrigger: boolean = false;

    constructor(parent: GameObject, size?: Size) {
        this.parent = parent;
        let x: number = parent.Transform.X;
        let y: number = parent.Transform.Y;

        this.offsetX = 0;
        this.offsetY = 0;

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

    public onCollisionEnter(collider: Collider, result: Result) {
        let collision: Collision = new Collision(this, collider, result);
        if (this.isTrigger) {
            this.parent.onTriggerEnter(collision);
        } else {
            this.parent.onCollisionEnter(collision);
        }
    }

    public onCollisionStay(collider: Collider, result: Result) {
        let collision: Collision = new Collision(this, collider, result);
        if (this.isTrigger) {
            this.parent.onTriggerStay(collision);
        } else {
            this.parent.onCollisionStay(collision);
        }
    }

    public onCollisionExit(collider: Collider, result: Result) {
        let collision: Collision = new Collision(this, collider, result);
        if (this.isTrigger) {
            this.parent.onTriggerExit(collision);
        } else {
            this.parent.onCollisionExit(collision);
        }
    }

    public update() {
        this.shape.x = this.parent.Transform.X + this.offsetX;
        this.shape.y = this.parent.Transform.Y + this.offsetY;
    }

    resize() {
        if(this.shape instanceof Polygon) {
            let w: number = this.width / 2;
            let h: number = this.height / 2;
            this.shape.setPoints([[-w, -h], [w, -h], [w, h], [-w, h]]);
        } else { //circle
            this.shape.radius = this.width;
            this.height = this.shape.radius;
        }
    }

    set Rotation(rotation: number) {
        if(this.shape instanceof Polygon) {
            this.shape.rotation = rotation;
        }
        this.rotation = rotation;
    }

    get Rotation(): number {
        return this.rotation;
    }

    get IsActive(): boolean {
        return this.isActive;
    }

    get Body(): Body {
        return this.shape;
    }

    get Parent(): GameObject {
        return this.parent;
    }

    get IsTrigger(): boolean {
        return this.isTrigger;
    }

    set IsActive(isActive: boolean) {
        this.isActive = isActive;
    }

    set IsTriger(isTrigger: boolean) {
        this.isTrigger = isTrigger;
    }

    set OffsetX(offset: number) {
        this.offsetX = offset;
    }

    set OffsetY(offset: number) {
        this.offsetY = offset;
    }

    public isColliding(): boolean {
        let potentials: Body[] = this.Body.potentials();

        for (let body of potentials) {
            if(this.Body.collides(body)) {
                return true;
            }
        }
        return false;
    }
}