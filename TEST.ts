export enum INPUT {
    NONE = 0,
    UP,
    DOWN,
    LEFT,
    RIGHT,
}

export const InputMap: Map<number, INPUT> = new Map<number, INPUT>([
    [87, INPUT.UP],
    [83, INPUT.DOWN],

    [65, INPUT.LEFT],
    [68, INPUT.RIGHT],
]);


console.log(1 == INPUT.DOWN);

