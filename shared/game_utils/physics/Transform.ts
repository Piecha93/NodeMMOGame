import {SerializableProperty} from "../../serialize/SerializeDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable, SerializableTypes} from "../../serialize/Serializable"
import {Polygon, Circle} from "detect-collisions";

export type Vector2 = [number, number];
export type Size = number | [number, number];

export class Transform extends Serializable {
    @SerializableProperty(ChangesDict.SCALEX, SerializableTypes.Uint16)
    private scaleX: number;
    @SerializableProperty(ChangesDict.SCALEY, SerializableTypes.Uint16)
    private scaleY: number;

    @SerializableProperty(ChangesDict.X, SerializableTypes.Float32)
    private x;
    @SerializableProperty(ChangesDict.Y, SerializableTypes.Float32)
    private y;

    @SerializableProperty(ChangesDict.ROTATION, SerializableTypes.Float32)
    private rotation;

    constructor(position: Vector2, size?: Size) {
        super();

        this.x = position[0];
        this.y = position[1];

        this.Rotation = 0;

        if (!size) {
            this.scaleX = 32;
            this.scaleY = 32;
        }
        else if (size instanceof Array) {
            this.scaleX = size[0];
            this.scaleY = size[1];
        } else {
            this.scaleX = size;
            this.scaleY = size;
        }
    }

    rotate(angle: number) {
        this.Rotation += angle;
    }

    distanceTo(transform: Transform) {
        return Transform.Distance(this, transform);
    }

    get X(): number {
        return this.x;
    }

    set X(x: number) {
        this.addChange(ChangesDict.X);
        this.x = x;
    }

    get Y(): number {
        return this.y;
    }

    set Y(y: number) {
        this.addChange(ChangesDict.Y);
        this.y = y;
    }

    set ScaleX(width: number) {
        if(this.scaleX == width) return;

        this.scaleX = width;
        this.addChange(ChangesDict.SCALEX);
    }

    get ScaleX(): number {
        return this.scaleX;
    }

    set ScaleY(height: number) {
        if(this.scaleY == height) return;

        this.scaleY = height;
        this.addChange(ChangesDict.SCALEY);
    }

    get ScaleY(): number {
        return this.scaleY;
    }

    get Position(): Vector2 {
        return [this.X, this.Y];
    }

    set Rotation(rotation: number) {
        this.addChange(ChangesDict.ROTATION);
        this.rotation = rotation;
    }

    get Rotation(): number {
        return this.rotation;
    }


    static Distance(t1: Transform, t2: Transform): number {
        return Math.sqrt(Math.pow(t1.X - t2.X, 2) + Math.pow(t1.Y - t2.Y, 2));
    }
}