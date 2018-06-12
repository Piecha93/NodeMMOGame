export enum INPUT {
    NONE,
    UP,
    DOWN,
    LEFT,
    RIGHT,
    FIRE,
    WALL
}

export const InputMap: Map<string, INPUT> = new Map<string, INPUT>([
    ['KeyW', INPUT.UP],
    ['KeyS', INPUT.DOWN],

    ['KeyA', INPUT.LEFT],
    ['KeyD', INPUT.RIGHT],

    ['KeyF', INPUT.WALL],
]);