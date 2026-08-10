import {INPUT_COMMAND} from "../input/InputCommands";
import {DeltaTimer} from "../utils/DeltaTimer";

export class InvalidInputSnapshotError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidInputSnapshotError";
    }
}

export class InputSnapshot {
    static readonly MAX_SERIALIZED_LENGTH = 1024;
    static readonly MAX_COMMANDS = Object.values(INPUT_COMMAND)
        .filter((value: string | number) => typeof value === "number").length;

    private static readonly MAX_COMMAND_VALUE_LENGTH = 128;
    private static readonly MAX_ABSOLUTE_COORDINATE = 1_000_000;

    static NextId = 0;
    private id: number;
    private time: number;
    private commandList: Map<INPUT_COMMAND, any>;
    private snapshotDelta: number = 0;

    constructor(serializedSnapshot?: string) {
        this.resetTime();
        this.commandList = new Map<INPUT_COMMAND, any>();

        if(serializedSnapshot !== undefined) {
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
        if(typeof serializedSnapshot !== "string") {
            throw new InvalidInputSnapshotError("Input snapshot must be a string");
        }

        if(serializedSnapshot.length === 0) {
            throw new InvalidInputSnapshotError("Input snapshot cannot be empty");
        }

        if(serializedSnapshot.length > InputSnapshot.MAX_SERIALIZED_LENGTH) {
            throw new InvalidInputSnapshotError("Input snapshot exceeds the size limit");
        }

        const separatorIndex: number = serializedSnapshot.indexOf("=");
        if(separatorIndex <= 0 || separatorIndex !== serializedSnapshot.lastIndexOf("=")) {
            throw new InvalidInputSnapshotError("Input snapshot has an invalid structure");
        }

        const serializedId: string = serializedSnapshot.slice(0, separatorIndex);
        const serializedCommands: string = serializedSnapshot.slice(separatorIndex + 1);

        if(!/^\d+$/.test(serializedId)) {
            throw new InvalidInputSnapshotError("Input snapshot id must be a non-negative integer");
        }

        const parsedId: number = Number(serializedId);
        if(!Number.isSafeInteger(parsedId)) {
            throw new InvalidInputSnapshotError("Input snapshot id exceeds the safe integer range");
        }

        if(serializedCommands.length === 0) {
            throw new InvalidInputSnapshotError("Input snapshot must contain at least one command");
        }

        const commands: string[] = serializedCommands.split('#');
        if(commands.length > InputSnapshot.MAX_COMMANDS) {
            throw new InvalidInputSnapshotError("Input snapshot contains too many commands");
        }

        const parsedCommands: Map<INPUT_COMMAND, string> = new Map<INPUT_COMMAND, string>();
        commands.forEach((serializedCommand: string) => {
            const valueSeparatorIndex: number = serializedCommand.indexOf(':');
            if(valueSeparatorIndex <= 0 || valueSeparatorIndex !== serializedCommand.lastIndexOf(':')) {
                throw new InvalidInputSnapshotError("Input command has an invalid structure");
            }

            const serializedCommandId: string = serializedCommand.slice(0, valueSeparatorIndex);
            const value: string = serializedCommand.slice(valueSeparatorIndex + 1);

            if(!/^\d+$/.test(serializedCommandId)) {
                throw new InvalidInputSnapshotError("Input command id must be a non-negative integer");
            }

            const command: number = Number(serializedCommandId);
            if(!InputSnapshot.isKnownCommand(command)) {
                throw new InvalidInputSnapshotError("Input snapshot contains an unknown command");
            }

            if(parsedCommands.has(command)) {
                throw new InvalidInputSnapshotError("Input snapshot contains a duplicate command");
            }

            InputSnapshot.validateCommandValue(command, value);
            parsedCommands.set(command, value);
        });

        this.id = parsedId;
        this.commandList = parsedCommands;
    }

    private static isKnownCommand(command: number): command is INPUT_COMMAND {
        return Number.isInteger(command) && typeof INPUT_COMMAND[command] === "string";
    }

    private static validateCommandValue(command: INPUT_COMMAND, value: string) {
        if(value.length === 0) {
            throw new InvalidInputSnapshotError("Input command value cannot be empty");
        }

        if(value.length > InputSnapshot.MAX_COMMAND_VALUE_LENGTH) {
            throw new InvalidInputSnapshotError("Input command value exceeds the size limit");
        }

        if(/^[+-]?(?:NaN|Infinity)$/i.test(value)) {
            throw new InvalidInputSnapshotError("Input command value must be finite");
        }

        switch(command) {
            case INPUT_COMMAND.UP:
            case INPUT_COMMAND.DOWN:
            case INPUT_COMMAND.HORIZONTAL:
            case INPUT_COMMAND.LEFT:
            case INPUT_COMMAND.RIGHT:
            case INPUT_COMMAND.VERTICAL:
                InputSnapshot.validateDirection(value);
                break;
            case INPUT_COMMAND.LEFT_MOUSE:
            case INPUT_COMMAND.RIGHT_MOUSE:
            case INPUT_COMMAND.MIDDLE_MOUSE:
            case INPUT_COMMAND.TEST:
                InputSnapshot.validatePosition(value);
                break;
            case INPUT_COMMAND.INTERACT:
                InputSnapshot.validateObjectId(value);
                break;
            case INPUT_COMMAND.SWITCH_WEAPON:
                if(value !== "null") {
                    throw new InvalidInputSnapshotError("Switch weapon command cannot contain a payload");
                }
                break;
            default:
                throw new InvalidInputSnapshotError("Input snapshot contains an unknown command");
        }
    }

    private static validateDirection(value: string) {
        const direction: number = InputSnapshot.parseFiniteNumber(value);
        if(direction < -1 || direction > 1) {
            throw new InvalidInputSnapshotError("Input direction must be between -1 and 1");
        }
    }

    private static validatePosition(value: string) {
        const coordinates: string[] = value.split(',');
        if(coordinates.length !== 2) {
            throw new InvalidInputSnapshotError("Input position must contain two coordinates");
        }

        coordinates.forEach((coordinate: string) => {
            const parsedCoordinate: number = InputSnapshot.parseFiniteNumber(coordinate);
            if(Math.abs(parsedCoordinate) > InputSnapshot.MAX_ABSOLUTE_COORDINATE) {
                throw new InvalidInputSnapshotError("Input coordinate exceeds the allowed range");
            }
        });
    }

    private static validateObjectId(value: string) {
        if(value === "null") {
            return;
        }

        if(!/^[A-Za-z]\d{1,63}$/.test(value)) {
            throw new InvalidInputSnapshotError("Interaction target has an invalid id");
        }
    }

    private static parseFiniteNumber(value: string): number {
        if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
            throw new InvalidInputSnapshotError("Input command value must be a number");
        }

        const parsedValue: number = Number(value);
        if(!Number.isFinite(parsedValue)) {
            throw new InvalidInputSnapshotError("Input command value must be finite");
        }

        return parsedValue;
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
