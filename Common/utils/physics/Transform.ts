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
        // let s: number = Math.sin(angle);
        // let c: number = Math.cos(angle);
        //
        // let cx: number = this.Width / 2;
        // let cy: number = this.Height / 2;
        //
        // this.X -= cx;
        // this.Y -= cy;
        //
        // let xnew: number = this.X * c - this.Y * s;
        // let ynew: number = this.X * s + this.Y * c;
        //
        // console.log(this.X * c - this.Y * s);
        //
        // this.X = xnew + cx;
        // this.Y = ynew + cy;
        //

         // this.polygon = this.polygon.translate(-this.Width / 2, -this.Height / 2);
         //this.X -= this.Width / 2;
         //this.Y -= this.Height / 2;

        //this.Polygon.rotate(0.1);
        this.polygon.rotate(0.05);
         console.log(this.Rotation);

         // this.polygon.translate(this.Width / 2, this.Height / 2);
        //this.X += this.Width / 2;
        //this.Y += this.Height / 2;
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