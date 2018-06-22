import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable} from "../../serialize/Serializable"
import {Polygon, Circle} from "detect-collisions";

import { Message, Type, Field, OneOf } from "protobufjs/light";

// @Type.d("TransformMessage")
export class Transform  extends Message<Transform>{ //extends Serializable {
    private shape: Polygon | Circle;

    @Field.d(13, "float", "optional")
    private width: number;
    @Field.d(14, "float", "optional")
    private height: number;
    private angle = 0;

    constructor(x?: number, y?: number, width?: number, height?: number) {
        super();

        x = x || 0;
        y = y || 0;

        this.width = width || 32;
        this.height = height || this.width;

        if(!height) {
            this.shape = new Circle(x, y, width);
        } else {
            let w: number = this.Width / 2;
            let h: number = this.Height / 2;

            this.shape = new Polygon(x, y, [[-w, -h], [w, -h], [w, h], [-w, h]]);
        }
    }

    rotate(angle: number) {
        this.Rotation += angle;
    }

    get Magnitude(): number {
        return 0;
        // return this.shape.pos.len();
    }

    get Body(): Polygon | Circle {
        return this.shape;
    }

    get X(): number {
        return this.shape.x;
    }

    // @NetworkProperty(ChangesDict.X,)
    set X(x: number) {
        this.shape.x = x;
    }

    // @Field.d(12, "float", "optional")
    get Y(): number {
        return this.shape.y;
    }

    // @NetworkProperty(ChangesDict.Y)
    set Y(y: number) {
        this.shape.y = y;
    }

    // @NetworkProperty(ChangesDict.WIDTH)
    set Width(width: number) {
        if(this.width == width) return;
        this.width = width;

        if(this.shape instanceof Polygon) {
            let w: number = this.Width / 2;
            let h: number = this.Height / 2;
            this.shape.setPoints([[-w, -h], [w, -h], [w, h], [-w, h]]);
        } else { //circle
            this.shape.radius = this.width;
            this.height = this.shape.radius;
        }

        // this.addChange(ChangesDict.WIDTH);
    }

    get Width(): number {
        return this.width;
    }

    // @NetworkProperty(ChangesDict.HEIGHT)
    set Height(height: number) {
        if(this.height == height) return;
        this.height = height;

        if(this.shape instanceof Polygon) {
            let w: number = this.Width / 2;
            let h: number = this.Height / 2;
            this.shape.setPoints([[-w, -h], [w, -h], [w, h], [-w, h]]);
        } else { //circle
            this.shape.radius = this.width;
            this.height = this.shape.radius;
        }
        // this.addChange(ChangesDict.HEIGHT);
    }

    get Height(): number {
        return this.height;
    }

    // @NetworkProperty(ChangesDict.ROTATION)
    set Rotation(angle: number) {
        if(this.shape instanceof Polygon) {
            this.shape.angle = angle;
        }
        this.angle = angle;
    }

    get Rotation(): number {
        return this.angle;
    }
}