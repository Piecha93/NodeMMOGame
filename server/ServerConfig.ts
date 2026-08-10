export class ServerConfig {
    public static DATABASE_URL = process.env.MONGODB_URI;
    public static TICKRATE = 1 / 64 * 1000;
    public static CLIENT_TIMEOUT_TIME = 8000; //time in ms
    public static UPDATE_INTERVAL = 1 / 25 * 1000; //updates interval in ms (ex. 1 / 20 * 1000 => 20 updates per secound)
    public static DISCONNECT_CHECK_INTERVAL = 1000; //time in ms

    public static MAX_CHAT_MESSAGE_LENGTH = 500;
    public static MAX_SOCKET_MESSAGE_SIZE = 16 * 1024;
    public static RATE_LIMIT_WINDOW = 1000;
    public static MAX_CHAT_MESSAGES_PER_WINDOW = 5;
    public static MAX_INPUT_SNAPSHOTS_PER_WINDOW = 30;
    public static MAX_HEARTBEATS_PER_WINDOW = 5;

    public static ENABLE_DEBUG_COMMANDS = process.env.ENABLE_DEBUG_COMMANDS === "true";
}
