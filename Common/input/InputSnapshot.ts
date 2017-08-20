import {INPUT_COMMAND, InputCommands} from "../../Common/input/InputCommands";
export class InputSnapshot {
    private commandList: Map<INPUT_COMMAND, string>;

    constructor(serializedSnapshot?: string) {
        if(serializedSnapshot) {
            this.deserialize(serializedSnapshot);
        } else {
            this.commandList = new Map<INPUT_COMMAND, string>();
        }
    }

    get Commands(): Map<INPUT_COMMAND, string> {
        return this.commandList;
    }

    public append(command: INPUT_COMMAND, value: string) {
        this.commandList.set(command, value);
    }

    public serializeSnapshot(): string {
        let serializedSnapshot: string = '';
        this.commandList.forEach((value:string, key: INPUT_COMMAND) => {
            serializedSnapshot += '#' + key.toString() + ':' + value;
        });
        return serializedSnapshot.slice(1);
    }

    deserialize(serializedSnapshot: string) {
        this.commandList.clear();
        let commands: string[] = serializedSnapshot.split('#');
        commands.forEach((command: string) => {
            let splited: string[] = command.split(':');
            this.commandList.set(Number(splited[0]), splited[1]);
        });
    }
}