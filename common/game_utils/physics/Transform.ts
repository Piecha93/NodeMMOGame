import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable, SerializableTypes} from "../../serialize/Serializable"
import {Polygon, Circle} from "detect-collisions";

export class Transform extends Serializable {
    private shape: Polygon | Circle;

    private width: number;
    private height: number;
    private angle = 0;

    constructor(x: number, y: number, width?: number, height?: number) {
        super();

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

    @NetworkProperty(ChangesDict.X, SerializableTypes.Float32)
    set X(x: number) {
        this.addChange(ChangesDict.X);
        this.shape.x = x;
    }

    get Y(): number {
        return this.shape.y;
    }

    @NetworkProperty(ChangesDict.Y, SerializableTypes.Float32)
    set Y(y: number) {
        this.addChange(ChangesDict.Y);
        this.shape.y = y;
    }

    @NetworkProperty(ChangesDict.WIDTH, SerializableTypes.Uint16)
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

        this.addChange(ChangesDict.WIDTH);
    }

    get Width(): number {
        return this.width;
    }

    @NetworkProperty(ChangesDict.HEIGHT, SerializableTypes.Uint16)
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
        this.addChange(ChangesDict.HEIGHT);
    }

    get Height(): number {
        return this.height;
    }

    @NetworkProperty(ChangesDict.ROTATION, SerializableTypes.Float32)
    set Rotation(angle: number) {
        if(this.shape instanceof Polygon) {
            this.shape.angle = angle;
        }
        this.angle = angle;
    }

    get Rotation(): number {
        this.addChange(ChangesDict.ROTATION);
        return this.angle;
    }
}