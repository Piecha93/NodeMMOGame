import { Circle, Polygon, Result } from "detect-collisions";

export const INPUT_STRIDE = 13;
export const OUTPUT_STRIDE = 6;

/** Pure SAT replay. These caches are owned by one runner, never by the game world. */
export function createCollisionReplayKernel(definitions) {
    const createShape = (definition) =>
        definition.type === "circle" ? new Circle(0, 0, definition.radius) : new Polygon(0, 0, definition.points);
    const leftShapes = definitions.map(createShape);
    const rightShapes = definitions.map(createShape);
    const result = new Result();
    const applyTransform = (shapes, input, offset) => {
        const shape = shapes[input[offset]];
        if (!shape) throw new Error("Unknown replay geometry");
        shape.x = input[offset + 1];
        shape.y = input[offset + 2];
        if (shape instanceof Circle) shape.scale = input[offset + 4];
        else {
            shape.angle = input[offset + 3];
            shape.scale_x = input[offset + 4];
            shape.scale_y = input[offset + 5];
        }
        return shape;
    };
    return (input) => {
        if (!(input instanceof Float64Array) || input.length % INPUT_STRIDE !== 0)
            throw new Error("Invalid replay input");
        const output = new Float64Array((input.length / INPUT_STRIDE) * OUTPUT_STRIDE);
        for (let source = 0, target = 0; source < input.length; source += INPUT_STRIDE, target += OUTPUT_STRIDE) {
            const a = applyTransform(leftShapes, input, source + 1);
            const b = applyTransform(rightShapes, input, source + 7);
            const collision = a.collides(b, input[source] ? result : undefined);
            output[target] = Number(collision);
            if (collision && input[source]) {
                output[target + 1] = Number(result.a_in_b);
                output[target + 2] = Number(result.b_in_a);
                output[target + 3] = result.overlap;
                output[target + 4] = result.overlap_x;
                output[target + 5] = result.overlap_y;
            }
        }
        return output;
    };
}
