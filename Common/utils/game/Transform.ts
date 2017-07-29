import * as SAT from 'sat';

export class Transform {
    private vector: SAT.Vector;
    private polygon: SAT.Polygon;

    private width: number;
    private height: number;

    constructor(x?: number, y?: number, width?: number, height?: number) {
        x = x || 0;
        y = y || 0;

        this.width = width || 32;
        this.height = height || 32;

        this.vector = new SAT.Vector(x, y);
        this.polygon = new SAT.Box(this.vector, this.width, this.height).toPolygon();
    }

    static testCollision(t1: Transform, t2: Transform) {
        return SAT.testPolygonPolygon(t1.polygon, t2.Polygon);
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
        this.polygon = new SAT.Box(this.vector, this.width, this.height).toPolygon();
    }

    get Width(): number {
        return this.width;
    }

    set Height(height: number) {
        this.height  = height;
        this.polygon = new SAT.Box(this.vector, this.width, this.height).toPolygon();
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