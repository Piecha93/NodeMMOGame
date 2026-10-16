import { InputCommand, InputAction } from "../protocol";
import { InputSnapshot } from "../input/InputSnapshot";
import { INPUT_COMMAND } from "../input/InputCommands";

export function commandToSnapshot(command: InputCommand, actions = true): InputSnapshot {
    const snapshot = new InputSnapshot(`${command.seq}=2:${command.horizontal}#5:${command.vertical}`);
    if (actions)
        for (const action of command.actions ?? []) {
            if (action.kind === "interact") snapshot.append(INPUT_COMMAND.INTERACT, action.targetId);
            else if (action.kind === "switchWeapon") snapshot.append(INPUT_COMMAND.SWITCH_WEAPON, "null");
            else
                snapshot.append(
                    action.kind === "primary"
                        ? INPUT_COMMAND.LEFT_MOUSE
                        : action.kind === "secondary"
                          ? INPUT_COMMAND.RIGHT_MOUSE
                          : INPUT_COMMAND.MIDDLE_MOUSE,
                    `${action.x},${action.y}`,
                );
        }
    return snapshot;
}

export function snapshotActions(snapshot: InputSnapshot): InputAction[] {
    const result: InputAction[] = [];
    for (const [key, value] of snapshot.Commands) {
        if (key === INPUT_COMMAND.INTERACT && value !== "null")
            result.push({ kind: "interact", targetId: String(value) });
        else if (key === INPUT_COMMAND.SWITCH_WEAPON) result.push({ kind: "switchWeapon" });
        else if ([INPUT_COMMAND.LEFT_MOUSE, INPUT_COMMAND.RIGHT_MOUSE, INPUT_COMMAND.MIDDLE_MOUSE].includes(key)) {
            const [x = 0, y = 0] = String(value).split(",").map(Number);
            result.push({
                kind:
                    key === INPUT_COMMAND.LEFT_MOUSE
                        ? "primary"
                        : key === INPUT_COMMAND.RIGHT_MOUSE
                          ? "secondary"
                          : "middle",
                x,
                y,
            });
        }
    }
    return result;
}
