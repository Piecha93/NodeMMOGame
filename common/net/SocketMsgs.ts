export class SocketMsgs {
    public static CONNECTION = 'connection';
    public static DISCONNECT = 'disconnect';
    public static CLIENT_READY = '0';
    public static START_GAME = '1';
    public static INITIALIZE_GAME = '2';
    public static HEARTBEAT = '3';
    public static HEARTBEAT_RESPONSE = '4';
    public static UPDATE_GAME = '5';
    public static FIRST_UPDATE_GAME = '6';
    public static INPUT_SNAPSHOT = '7';
    public static CHAT_MESSAGE = '8';
    public static UPDATE_SNAPSHOT_DATA = '9';
    public static ERROR = '10';
}