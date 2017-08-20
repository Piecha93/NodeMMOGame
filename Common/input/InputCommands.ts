export enum INPUT_COMMAND {
    MOVE_DIRECTION,
    FIRE
}

export const InputCommands: Map<string, INPUT_COMMAND> = new Map<string, INPUT_COMMAND>([
    ["D", INPUT_COMMAND.MOVE_DIRECTION],
    ["C", INPUT_COMMAND.FIRE],
]);