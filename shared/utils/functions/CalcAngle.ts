type Point = [number, number];

export function calcAngle(p1: Point , p2: Point) {
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) + Math.PI;
}