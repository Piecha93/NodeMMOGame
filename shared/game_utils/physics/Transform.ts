import {SerializableProperty} from "../../serialize/SerializeDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable, SerializableTypes} from "../../serialize/Serializable"
import {Polygon, Circle} from "detect-collisions";

export type Position = [number, number];
export type Size = number | [number, number];

export class Transform extends Serializable {
    private shape: Polygon | Circle;

    private width: number;
    private height: number;
    private angle = 0;

    constructor(position: Position, size?: Size) {
        super();

        let x: number = position[0];
        let y: number = position[1];


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

    resize() {
        if(this.shape instanceof Polygon) {
            let w: number = this.Width / 2;
            let h: number = this.Height / 2;
            this.shape.setPoints([[-w, -h], [w, -h], [w, h], [-w, h]]);
        } else { //circle
            this.shape.radius = this.width;
            this.height = this.shape.radius;
            this.addChange(ChangesDict.WIDTH);
            this.addChange(ChangesDict.HEIGHT);
        }
    }

    rotate(angle: number) {
        this.Rotation += angle;
    }

    get Body(): Polygon | Circle {
        return this.shape;
    }

    get X(): number {
        return this.shape.x;
    }

    @SerializableProperty(ChangesDict.X, SerializableTypes.Float32)
    set X(x: number) {
        this.addChange(ChangesDict.X);
        this.shape.x = x;
    }

    get Y(): number {
        return this.shape.y;
    }

    @SerializableProperty(ChangesDict.Y, SerializableTypes.Float32)
    set Y(y: number) {
        this.addChange(ChangesDict.Y);
        this.shape.y = y;
    }

    @SerializableProperty(ChangesDict.WIDTH, SerializableTypes.Uint16)
    set Width(width: number) {
        if(this.width == width) return;

        this.width = width;
        this.resize();
        this.addChange(ChangesDict.WIDTH);
    }

    get Width(): number {
        return this.width;
    }

    @SerializableProperty(ChangesDict.HEIGHT, SerializableTypes.Uint16)
    set Height(height: number) {
        if(this.height == height) return;

        this.height = height;
        this.resize();
        this.addChange(ChangesDict.HEIGHT);
    }

    get Height(): number {
        return this.height;
    }

    get Position(): Position {
        return [this.X, this.Y];
    }

    @SerializableProperty(ChangesDict.ROTATION, SerializableTypes.Float32)
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