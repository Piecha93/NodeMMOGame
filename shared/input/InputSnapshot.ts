import {INPUT_COMMAND} from "../input/InputCommands";
import {DeltaTimer} from "../utils/DeltaTimer";

export class InputSnapshot {
    static NextId = 0;
    private id: number;
    private time: number;
    private commandList: Map<INPUT_COMMAND, any>;
    private snapshotDelta: number = 0;

    constructor(serializedSnapshot?: string) {
        this.resetTime();
        this.commandList = new Map<INPUT_COMMAND, any>();

        if(serializedSnapshot) {
            this.deserialize(serializedSnapshot);
        } else {
            this.id = InputSnapshot.NextId++;
        }
    }

    public append(command: INPUT_COMMAND, value: any) {
        this.commandList.set(command, value);
    }

    public isMoving(): boolean {
        return (this.Commands.has(INPUT_COMMAND.HORIZONTAL) && this.Commands.get(INPUT_COMMAND.HORIZONTAL) != 0) ||
               (this.Commands.has(INPUT_COMMAND.VERTICAL) && this.Commands.get(INPUT_COMMAND.VERTICAL) != 0);
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

    public resetTime() {
        this.time = DeltaTimer.getTimestamp();
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

    get Commands(): Map<INPUT_COMMAND, any> {
        return this.commandList;
    }
}