import { Polygon, Circle, Body, Result } from "detect-collisions";
import { Size, Vector2 } from "./Transform";
import { GameObject } from "../game/objects/GameObject";
import { Collision } from "./Collision";

export class Collider {
    private shape: Polygon | Circle;

    private width: number;
    private height: number;
    private parent: GameObject;
    private rotation = 0;
    private readonly widthRatio: number;
    private readonly heightRatio: number;
    private isRectangle = true;

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

        if (!size) {
            this.width = 32;
            this.height = 32;
        } else if (size instanceof Array) {
            this.width = size[0];
            this.height = size[1];
        } else {
            this.width = size;
            this.height = size;
            isCircle = true;
        }

        if (isCircle) {
            this.shape = new Circle(x, y, this.width);
        } else {
            let w: number = this.width / 2;
            let h: number = this.height / 2;

            this.shape = new Polygon(x, y, [
                [-w, -h],
                [w, -h],
                [w, h],
                [-w, h],
            ]);
            const polygon = this.shape as Polygon & { setPoints(points: number[][]): void };
            const setPoints = polygon.setPoints;
            polygon.setPoints = (points) => {
                // Body is public. Arbitrary polygons must retain the general
                // SAT path even if the caller keeps their rotation at zero.
                this.isRectangle = false;
                setPoints.call(polygon, points);
            };
        }
        this.widthRatio = parent.Transform.ScaleX === 0 ? 1 : this.width / parent.Transform.ScaleX;
        this.heightRatio = parent.Transform.ScaleY === 0 ? 1 : this.height / parent.Transform.ScaleY;
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
        const width = this.parent.Transform.ScaleX * this.widthRatio;
        const height = this.shape instanceof Circle ? width : this.parent.Transform.ScaleY * this.heightRatio;
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            this.resize();
        }
        this.shape.x = this.parent.Transform.X + this.offsetX;
        this.shape.y = this.parent.Transform.Y + this.offsetY;
        if (this.rotation != this.parent.Transform.Rotation) {
            this.Rotation = this.parent.Transform.Rotation;
        }
    }

    /** Axis-aligned rectangles avoid SAT's repeated vertex projections. */
    public collides(other: Collider, result?: Result): boolean {
        const a = this.shape;
        const b = other.shape;
        if (
            !(a instanceof Polygon) ||
            !(b instanceof Polygon) ||
            !this.isRectangle ||
            !other.isRectangle ||
            a.angle !== 0 ||
            b.angle !== 0 ||
            a.scale_x <= 0 ||
            a.scale_y <= 0 ||
            b.scale_x <= 0 ||
            b.scale_y <= 0 ||
            this.width <= 0 ||
            this.height <= 0 ||
            other.width <= 0 ||
            other.height <= 0
        ) {
            return a.collides(b, result);
        }

        const aWidth = (this.width * a.scale_x) / 2;
        const aHeight = (this.height * a.scale_y) / 2;
        const bWidth = (other.width * b.scale_x) / 2;
        const bHeight = (other.height * b.scale_y) / 2;
        const aMinX = a.x - aWidth;
        const aMaxX = a.x + aWidth;
        const aMinY = a.y - aHeight;
        const aMaxY = a.y + aHeight;
        const bMinX = b.x - bWidth;
        const bMaxX = b.x + bWidth;
        const bMinY = b.y - bHeight;
        const bMaxY = b.y + bHeight;
        const collision = aMinX < bMaxX && aMaxX > bMinX && aMinY < bMaxY && aMaxY > bMinY;
        if (!collision) return a.collides(b, result);
        if (result) {
            result.a = a;
            result.b = b;
            result.collision = collision;
            result.a_in_b = true;
            result.b_in_a = true;
            result.overlap = Infinity;
            result.overlap_x = 0;
            result.overlap_y = 0;
            // Match the library's axis order and tie breaking, including
            // fully contained rectangles and coincident centers.
            Collider.projectAxis(-aMaxY, -aMinY, -bMaxY, -bMinY, 0, -1, result);
            Collider.projectAxis(aMinX, aMaxX, bMinX, bMaxX, 1, -0, result);
            Collider.projectAxis(aMinY, aMaxY, bMinY, bMaxY, 0, 1, result);
            Collider.projectAxis(-aMaxX, -aMinX, -bMaxX, -bMinX, -1, -0, result);
        }
        return collision;
    }

    private static projectAxis(
        aStart: number,
        aEnd: number,
        bStart: number,
        bEnd: number,
        x: number,
        y: number,
        result: Result,
    ): void {
        let overlap: number;
        if (aStart < bStart) {
            result.a_in_b = false;
            if (aEnd < bEnd) {
                overlap = aEnd - bStart;
                result.b_in_a = false;
            } else {
                const first = aEnd - bStart;
                const second = bEnd - aStart;
                overlap = first < second ? first : -second;
            }
        } else {
            result.b_in_a = false;
            if (aEnd > bEnd) {
                overlap = aStart - bEnd;
                result.a_in_b = false;
            } else {
                const first = aEnd - bStart;
                const second = bEnd - aStart;
                overlap = first < second ? first : -second;
            }
        }
        const absolute = Math.abs(overlap);
        if (result.overlap > absolute) {
            const sign = overlap < 0 ? -1 : 1;
            result.overlap = absolute;
            result.overlap_x = x * sign;
            result.overlap_y = y * sign;
        }
    }

    resize() {
        if (this.shape instanceof Polygon) {
            let w: number = this.width / 2;
            let h: number = this.height / 2;
            const polygon = this.shape as Polygon & { setPoints(points: number[][]): void };
            polygon.setPoints([
                [-w, -h],
                [w, -h],
                [w, h],
                [-w, h],
            ]);
            this.isRectangle = true;
        } else {
            //circle
            this.shape.radius = this.width;
            this.height = this.shape.radius;
        }
    }

    set Rotation(rotation: number) {
        if (this.shape instanceof Polygon) {
            this.shape.angle = rotation;
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
            if (this.Body.collides(body)) {
                return true;
            }
        }
        return false;
    }
}
