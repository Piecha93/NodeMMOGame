import {NetworkProperty} from "../../serialize/NetworkDecorators";
import {ChangesDict} from "../../serialize/ChangesDict";
import {Serializable} from "../../serialize/Serializable"
import {Bodies, Body, Vector} from "matter-js";

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
        let newPos: Vector = Vector.clone(this.body.position);
        newPos.x = xy[0];
        newPos.y = xy[1];
        Body.setPosition(this.body, newPos);
    }

    get X(): number {
        return this.body.position.x;
    }

    @NetworkProperty(ChangesDict.X)
    set X(x: number) {
        let newPos: Vector = Vector.clone(this.body.position);
        newPos.x = x;
        Body.setPosition(this.body, newPos);
    }

    get Y(): number {
        return this.body.position.y;
    }

    @NetworkProperty(ChangesDict.Y)
    set Y(y: number) {
        let newPos: Vector = Vector.clone(this.body.position);
        newPos.y = y;
        Body.setPosition(this.body, newPos);
    }

    @NetworkProperty(ChangesDict.ScaleX)
    set ScaleX(x: number) {
        this.scaleX = x;
        Body.scale(this.body, x, this.scaleY);
    }

    get ScaleX(): number {
        return this.scaleX;
    }

    @NetworkProperty(ChangesDict.ScaleY)
    set ScaleY(y: number) {
        this.scaleY = y;
        Body.scale(this.body, this.scaleX, y);
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
        Body.setAngle(this.body, angle);
    }

    get Rotation(): number {
        return this.body.angle;
    }
}