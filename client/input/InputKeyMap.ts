import {INPUT_COMMAND} from "../../shared/input/InputCommands";

export const InputKeyMap: Map<INPUT_COMMAND, string> = new Map<INPUT_COMMAND, string>([
    [INPUT_COMMAND.HORIZONTAL_UP, 'w'],
    [INPUT_COMMAND.HORIZONTAL_DOWN, 's'],

    [INPUT_COMMAND.VERTICAL_LEFT, 'a'],
    [INPUT_COMMAND.VERTICAL_RIGHT, 'd'],

    [INPUT_COMMAND.INTERACT, 'e'],
    [INPUT_COMMAND.SWITCH_WEAPON, 'q'],

    [INPUT_COMMAND.TEST, 'f'],
]);