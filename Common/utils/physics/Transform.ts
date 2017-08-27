import * as SAT from 'sat';

import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable} from "../../serialize/Serializable"

export class Transform extends Serializable {
    private shape: SAT.Polygon | SAT.Circle;

    private width: number;
    private height: number;
    private angle = 0;

    constructor(x?: number, y?: number, width?: number, height?: number) {
        super();
        x = x || 0;
        y = y || 0;

        this.width = width || 32;
        this.height = height || this.width;

        let position: SAT.Vector = new SAT.Vector(x, y);

        if(!height) {
            this.shape = new SAT.Circle(position, this.width);
        } else {
            let w: number = this.Width / 2;
            let h: number = this.Height / 2;

            this.shape = new SAT.Polygon(position, [
                new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
                new SAT.Vector(w, h), new SAT.Vector(-w, h)
            ]);
        }
    }

    static testCollision(t1: Transform, t2: Transform, response?: SAT.Response) {
        let result: boolean;
        if(t1.Body instanceof SAT.Polygon && t2.Body instanceof SAT.Polygon) {
            result = SAT.testPolygonPolygon(t1.Body, t2.Body, response);
        } else if(t1.Body instanceof SAT.Circle && t2.Body instanceof SAT.Circle) {
            result = SAT.testCircleCircle(t1.Body, t2.Body, response);
        } else if(t1.Body instanceof SAT.Polygon && t2.Body instanceof SAT.Circle) {
            result = SAT.testPolygonCircle(t1.Body, t2.Body, response);
        } else if(t1.Body instanceof SAT.Circle && t2.Body instanceof SAT.Polygon) {
            result = SAT.testCirclePolygon(t1.Body, t2.Body, response);
        }

        return result;
    }


    rotate(angle: number) {
        this.Rotation += angle;
    }

    get Magnitude(): number {
        return this.shape.pos.len();
    }

    get Body(): SAT.Polygon | SAT.Circle {
        return this.shape;
    }

    get X(): number {
        return this.shape.pos.x;
    }

    @NetworkProperty(ChangesDict.X,)
    set X(x: number) {
        this.shape.pos.x = x;
    }

    get Y(): number {
        return this.shape.pos.y;
    }

    @NetworkProperty(ChangesDict.Y)
    set Y(y: number) {
        this.shape.pos.y = y;
    }

    @NetworkProperty(ChangesDict.WIDTH)
    set Width(width: number) {
        if(this.width == width) return;
        this.width = width;

        if(this.shape instanceof SAT.Polygon) {
            let w: number = this.Width / 2;
            let h: number = this.Height / 2;
            this.shape = new SAT.Polygon(this.shape.pos, [
                new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
                new SAT.Vector(w, h), new SAT.Vector(-w, h)
            ]);
        } else if(this.shape instanceof SAT.Circle) {
            this.shape.r = this.width;
            this.height = this.shape.r;
        }
    }

    get Width(): number {
        return this.width;
    }

    @NetworkProperty(ChangesDict.HEIGHT)
    set Height(height: number) {
        if(this.height == height) return;
        this.height = height;

        if(this.shape instanceof SAT.Polygon) {
            let w: number = this.Width / 2;
            let h: number = this.Height / 2;
            this.shape = new SAT.Polygon(this.shape.pos, [
                new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
                new SAT.Vector(w, h), new SAT.Vector(-w, h)
            ]);
        } else if(this.shape instanceof SAT.Circle) {
            this.shape.r = this.height;
            this.width = this.shape.r;
        }
    }

    get Height(): number {
        return this.height;
    }

    @NetworkProperty(ChangesDict.ROTATION)
    set Rotation(angle: number) {
        if(this.Body instanceof SAT.Polygon) {
            this.Body.setAngle(angle);
        }
        this.angle = angle;
    }

    get Rotation(): number {
        return this.angle;
    }
}