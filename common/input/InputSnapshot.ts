import {INPUT_COMMAND} from "../input/InputCommands";
import {DeltaTimer} from "../DeltaTimer";

export class InputSnapshot {
    static NextId = 0;
    private id: number;
    private time: number;
    private commandList: Map<INPUT_COMMAND, string>;
    private snapshotDelta: number = 0;

    constructor(serializedSnapshot?: string) {
        this.time = DeltaTimer.getTimestamp();
        if(serializedSnapshot) {
            this.deserialize(serializedSnapshot);
        } else {
            this.id = InputSnapshot.NextId++;
            this.commandList = new Map<INPUT_COMMAND, string>();
        }
    }

    public append(command: INPUT_COMMAND, value: string) {
        this.commandList.set(command, value);
    }

    public isMoving(): boolean {
        return this.Commands.has(INPUT_COMMAND.MOVE_DIRECTION) && this.Commands.get(INPUT_COMMAND.MOVE_DIRECTION) != "0";
    }

    public serializeSnapshot(): string {
        let serializedSnapshot: string = '';
        this.commandList.forEach((value:string, key: INPUT_COMMAND) => {
            serializedSnapshot += '#' + key.toString() + ':' + value;
        });

        return this.id + "=" + serializedSnapshot.slice(1);
    }

    public deserialize(serializedSnapshot: string) {
        this.commandList.clear();

        let splited = serializedSnapshot.split("=");

        this.id = Number(splited[0]);

        let commands: string[] = splited[1].split('#');
        commands.forEach((command: string) => {
            let splited: string[] = command.split(':');
            this.commandList.set(Number(splited[0]), splited[1]);
        });
    }

    get CreateTime(): number {
        return this.time;
    }

    setSnapshotDelta() {
        this.snapshotDelta = Date.now() - this.time;
    }

    get SnapshotDelta(): number {
        return this.snapshotDelta;
    }

    get ID(): number {
        return this.id;
    }

    get Commands(): Map<INPUT_COMMAND, string> {
        return this.commandList;
    }
}