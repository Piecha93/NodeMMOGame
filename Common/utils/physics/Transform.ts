import * as SAT from 'sat';

export class Transform {
    private polygon: SAT.Polygon;

    private width: number;
    private height: number;

    constructor(x?: number, y?: number, width?: number, height?: number) {
        x = x || 0;
        y = y || 0;

        this.width = width || 32;
        this.height = height || 32;

        let w: number = this.Width / 2;
        let h: number = this.Height / 2;

        this.polygon = new SAT.Polygon(new SAT.Vector(x, y), [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }

    static testCollision(t1: Transform, t2: Transform, response?: SAT.Response) {
        let result: boolean;
        if(response) {
            result = SAT.testPolygonPolygon(t1.Polygon, t2.Polygon, response);
        } else {
            result = SAT.testPolygonPolygon(t1.Polygon, t2.Polygon);
        }

        return result;
    }

    rotate(angle: number) {
        this.Rotation += angle;
    }

    get Polygon(): SAT.Polygon {
        return this.polygon;
    }

    get X(): number {
        return this.polygon.pos.x;
    }

    set X(x: number) {
        this.polygon.pos.x = x;
    }

    get Y(): number {
        return this.polygon.pos.y;
    }

    set Y(y: number) {
        this.polygon.pos.y = y;
    }

    set Width(width: number) {
        this.width = width;

        let w: number = this.Width / 2;
        let h: number = this.Height / 2;
        this.polygon = new SAT.Polygon(new SAT.Vector(this.X, this.Y), [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }

    get Width(): number {
        return this.width;
    }

    set Height(height: number) {
        this.height  = height;

        let w: number = this.Width / 2;
        let h: number = this.Height / 2;
        this.polygon = new SAT.Polygon(new SAT.Vector(this.X, this.Y), [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }

    get Height(): number {
        return this.height;
    }

    set Rotation(angle: number) {
        this.polygon.setAngle(angle);
    }

    get Rotation(): number {
        return this.polygon.angle;
    }
}