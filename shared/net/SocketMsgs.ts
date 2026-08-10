export const SocketMsgs = Object.freeze({
    CHAT_MESSAGE: String.fromCharCode(0),
    CLIENT_READY: String.fromCharCode(1),
    HEARTBEAT: String.fromCharCode(2),
    INPUT_SNAPSHOT: String.fromCharCode(3),

    CONNECTION: "connection",
    DISCONNECT: "disconnect",

    START_GAME: String.fromCharCode(4),
    INITIALIZE_GAME: String.fromCharCode(5),
    FIRST_UPDATE_GAME: String.fromCharCode(6),
    UPDATE_GAME: String.fromCharCode(7),
    HEARTBEAT_RESPONSE: String.fromCharCode(8),
    UPDATE_SNAPSHOT_DATA: String.fromCharCode(9),
    CHUNK_CHANGED: String.fromCharCode(10),
    ERROR: String.fromCharCode(11),
} as const);
