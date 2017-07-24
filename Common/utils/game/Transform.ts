export class Transform {
    private x: number;
    private y: number;

    private width: number;
    private height: number;

    private moved: boolean;

    private rotation: number = 0;

    constructor(x?: number, y?: number, width?: number, height?: number) {
        this.x = x || 0;
        this.y = y || 0;

        this.width = width || 32;
        this.height = height || 32;

        this.moved = false;
    }

    get Moved(): boolean {
        return this.moved;
    }

    set Moved(moved: boolean) {
        this.moved = moved;
    }

    get X(): number {
        return this.x;
    }

    set X(x: number) {
        this.moved = true;
        this.x = x;
    }

    get Y(): number {
        return this.y;
    }

    set Y(y: number) {
        this.moved = true;
        this.y = y;
    }

    set Width(width: number) {
        this.width = width;
    }

    get Width(): number {
        return this.width;
    }

    set Height(height: number) {
        this.height = height;
    }

    get Height(): number {
        return this.height;
    }

    set Rotation(rotation: number) {
        this.rotation = rotation;
    }

    get Rotation(): number {
        return this.rotation;
    }

    deserialize(input) {
        this.x = input.x;
        this.y = input.y;

        return this;
    }

    clone(position: Transform) {
        this.x = position.x;
        this.y = position.y;

        return new Transform(position.x, position.y);
    }
}