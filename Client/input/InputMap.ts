export enum INPUT {
    NONE,
    UP,
    DOWN,
    LEFT,
    RIGHT,
    FIRE,
    WALL
}

export const InputMap: Map<number, INPUT> = new Map<number, INPUT>([
    [87, INPUT.UP],
    [83, INPUT.DOWN],

    [65, INPUT.LEFT],
    [68, INPUT.RIGHT],

    [70, INPUT.WALL],
]);