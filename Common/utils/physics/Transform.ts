import * as SAT from 'sat';

import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable} from "../../serialize/Serializable"

export class Transform extends Serializable {
    private polygon: SAT.Polygon;

    private width: number;
    private height: number;

    constructor(x?: number, y?: number, width?: number, height?: number) {
        super();
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

    static add(t1: Transform, t2: Transform) {
        let result: Transform = new Transform();

        result.X = t1.X + t2.X;
        result.Y = t1.Y + t2.Y;

        return result;
    }

    static substract(t1: Transform, t2: Transform) {
        let result: Transform = new Transform();

        result.X = t1.X - t2.X;
        result.Y = t1.Y - t2.Y;

        return result;
    }

    static multiple(t1: Transform, scalar: number) {
        let result: Transform = new Transform();

        result.X = t1.X * scalar;
        result.Y = t1.Y * scalar;

        return result;
    }

    static divide(t1: Transform, scalar: number) {
        let result: Transform = new Transform();

        result.X = t1.X /= scalar;
        result.Y = t1.Y /= scalar;

        return result;
    }

    rotate(angle: number) {
        this.Rotation += angle;
    }

    get Magnitude(): number {
        return this.polygon.pos.len();
    }

    get Polygon(): SAT.Polygon {
        return this.polygon;
    }

    get X(): number {
        return this.polygon.pos.x;
    }

    @NetworkProperty(ChangesDict.X,)
    set X(x: number) {
        this.polygon.pos.x = x;
    }

    get Y(): number {
        return this.polygon.pos.y;
    }

    @NetworkProperty(ChangesDict.Y)
    set Y(y: number) {
        this.polygon.pos.y = y;
    }

    @NetworkProperty(ChangesDict.WIDTH)
    set Width(width: number) {
        if(this.width == width) return;
        this.width = width;

        let w: number = this.Width / 2;
        let h: number = this.Height / 2;
        this.polygon = new SAT.Polygon(this.polygon.pos, [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }

    get Width(): number {
        return this.width;
    }

    @NetworkProperty(ChangesDict.HEIGHT)
    set Height(height: number) {
        if(this.height == height) return;
        this.height = height;

        let w: number = this.Width / 2;
        let h: number = this.Height / 2;
        this.polygon = new SAT.Polygon(this.polygon.pos, [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }

    get Height(): number {
        return this.height;
    }

    @NetworkProperty(ChangesDict.ROTATION)
    set Rotation(angle: number) {
        this.polygon.setAngle(angle);
    }

    get Rotation(): number {
        return this.polygon.angle;
    }
}