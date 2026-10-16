import { SocketMsgs } from "../../shared/net/SocketMsgs";
import { InputSnapshot } from "../../shared/input/InputSnapshot";
import { Socket } from "socket.io-client";
import { INPUT_COMMAND } from "../../shared/input/InputCommands";

export class InputSender {
    private static readonly MOVEMENT_RETRY_INTERVAL = 100;
    private socket: Socket;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingMovement: { id: number; payload: string } | null = null;
    private disposed = false;
    private readonly ackHandler = (ack?: [number, number]) => {
        if (
            Array.isArray(ack) &&
            Number.isSafeInteger(ack[0]) &&
            this.pendingMovement &&
            ack[0] >= this.pendingMovement.id
        )
            this.stopRetry();
    };
    private readonly disconnectHandler = () => this.stopRetry();

    constructor(socket: Socket) {
        this.socket = socket;
        this.socket.on(SocketMsgs.UPDATE_SNAPSHOT_DATA, this.ackHandler);
        this.socket.on(SocketMsgs.DISCONNECT, this.disconnectHandler);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.stopRetry();
        this.socket.off(SocketMsgs.UPDATE_SNAPSHOT_DATA, this.ackHandler);
        this.socket.off(SocketMsgs.DISCONNECT, this.disconnectHandler);
    }

    public sendInput(snapshot: InputSnapshot) {
        if (this.disposed) return;
        this.stopRetry();
        const movement = [INPUT_COMMAND.HORIZONTAL, INPUT_COMMAND.VERTICAL]
            .filter((command) => snapshot.Commands.has(command))
            .map((command) => `${command}:${snapshot.Commands.get(command)}`);
        if (movement.length > 0) {
            // Reuse the sequence so accepted commands stay idempotent. Actions
            // are sent only once; a throttled key release can still recover.
            this.pendingMovement = { id: snapshot.ID, payload: `${snapshot.ID}=${movement.join("#")}` };
        }
        this.socket.emit(SocketMsgs.INPUT_SNAPSHOT, snapshot.serializeSnapshot());
        this.scheduleRetry();
    }

    private scheduleRetry() {
        if (!this.pendingMovement) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (!this.pendingMovement || !this.socket.connected) {
                this.stopRetry();
                return;
            }
            this.socket.emit(SocketMsgs.INPUT_SNAPSHOT, this.pendingMovement.payload);
            this.scheduleRetry();
        }, InputSender.MOVEMENT_RETRY_INTERVAL);
    }

    private stopRetry() {
        if (this.retryTimer !== null) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this.pendingMovement = null;
    }
}
