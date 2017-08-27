import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable} from "../../serialize/Serializable"
import {Body, Box} from "p2";

export class Transform extends Serializable {
    private body: Body;

    static Width = 32;
    static Height = 32;

    get Width(): number {
        return Transform.Width * this.scaleX;
    }

    get Height(): number {
        return Transform.Height * this.scaleY;
    }

    private scaleX: number = 1;
    private scaleY: number = 1;

    constructor(body: Body) {
        super();
        this.body = body;
    }

    get Body(): Body {
        return this.body;
    }

    rotate(angle: number) {
        this.Rotation += angle;
    }

    set XY(xy: [number, number]) {
        this.body.position = xy;
    }

    get X(): number {
        return this.body.position[0];
    }

    @NetworkProperty(ChangesDict.X)
    set X(x: number) {
        this.body.position[0] = x;
    }

    get Y(): number {
        return this.body.position[1];
    }

    @NetworkProperty(ChangesDict.Y)
    set Y(y: number) {
        this.body.position[1] = y;

    }

    @NetworkProperty(ChangesDict.ScaleX)
    set ScaleX(x: number) {
        this.scaleX = x;
    }

    get ScaleX(): number {
        return this.scaleX;
    }

    @NetworkProperty(ChangesDict.ScaleY)
    set ScaleY(y: number) {
        this.scaleY = y;
    }

    get ScaleY(): number {
        return this.scaleY;
    }

    // @NetworkProperty(ChangesDict.WIDTH)
    // set Width(width: number) {
    //     if(this.body.label == "Rectangle Body") {
    //         this.width = width;
    //     } else if(this.body.label == "Rectangle Body") {
    //         this.width = width;
    //     }
    // }
    //
    // get Width(): number {
    //     if(this.body.label == "Rectangle Body") {
    //         return this.width;
    //     } else if(this.body.label == "Rectangle Body") {
    //         return this.width;
    //     }
    //     return this.width;
    // }
    //
    // @NetworkProperty(ChangesDict.HEIGHT)
    // set Height(height: number) {
    //     if(this.body.label == "Rectangle Body") {
    //         this.height = height;
    //     } else if(this.body.label == "Rectangle Body") {
    //         this.height = height;
    //     }
    // }
    //
    // get Height(): number {
    //     if(this.body.label == "Rectangle Body") {
    //         return this.height;
    //     } else if(this.body.label == "Rectangle Body") {
    //         return this.height;
    //     }
    //     return this.height;
    // }

    @NetworkProperty(ChangesDict.ROTATION)
    set Rotation(angle: number) {
        this.body.angle = angle
    }

    get Rotation(): number {
        return this.body.angle;
    }
}