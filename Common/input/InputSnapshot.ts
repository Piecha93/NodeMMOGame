export class InputSnapshot {
    private commandList: Map<string, string>;

    constructor(serializedSnapshot?: string) {
        if(serializedSnapshot) {
            this.deserialize(serializedSnapshot);
        } else {
            this.commandList = new Map<string, string>();
        }
    }

    get Commands(): Map<string, string> {
        return this.commandList;
    }

    public append(command: string, value: string) {
        this.commandList.set(command, value);
    }

    public serializeSnapshot(): string {
        let serializedSnapshot: string = '';
        this.commandList.forEach((value:string, key: string) => {
            serializedSnapshot += '#' + key + ':' + value;
        });

        return serializedSnapshot.slice(1);
    }

    deserialize(serializedSnapshot: string) {
        this.commandList = new Map<string, string>();
        let commands: string[] = serializedSnapshot.split('#');
        commands.forEach((command: string) => {
            let splited: string[] = command.split(':');
            this.commandList.set(splited[0], splited[1]);
        });
    }
}