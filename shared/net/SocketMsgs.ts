let messageCode: number = 0;

export class SocketMsgs {
    public static CHAT_MESSAGE = String.fromCharCode(messageCode++);

    public static CLIENT_READY = String.fromCharCode(messageCode++);
    public static HEARTBEAT = String.fromCharCode(messageCode++);
    public static INPUT_SNAPSHOT = String.fromCharCode(messageCode++);
    public static CONNECTION = 'connection';
    public static DISCONNECT = 'disconnect';

    public static START_GAME = String.fromCharCode(messageCode++);
    public static INITIALIZE_GAME = String.fromCharCode(messageCode++);
    public static FIRST_UPDATE_GAME = String.fromCharCode(messageCode++);
    public static UPDATE_GAME = String.fromCharCode(messageCode++);
    public static HEARTBEAT_RESPONSE = String.fromCharCode(messageCode++);
    public static UPDATE_SNAPSHOT_DATA = String.fromCharCode(messageCode++);
    public static CHUNK_CHANGED = String.fromCharCode(messageCode++);
    public static ERROR = String.fromCharCode(messageCode++);
}