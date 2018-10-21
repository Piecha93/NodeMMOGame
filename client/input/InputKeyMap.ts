import {INPUT_COMMAND} from "../../shared/input/InputCommands";

export const InputKeyMap: Map<INPUT_COMMAND, string> = new Map<INPUT_COMMAND, string>([
    [INPUT_COMMAND.UP, 'w'],
    [INPUT_COMMAND.DOWN, 's'],

    [INPUT_COMMAND.LEFT, 'a'],
    [INPUT_COMMAND.RIGHT, 'd'],

    [INPUT_COMMAND.INTERACT, 'e'],
    [INPUT_COMMAND.SWITCH_WEAPON, 'q'],

    [INPUT_COMMAND.TEST, 'f'],
]);