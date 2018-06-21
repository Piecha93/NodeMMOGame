export class ServerConfig {
    public static DATABASE_URL = "mongodb://test:test@ds129352.mlab.com:29352/node-mmo-game";
    public static TICKRATE = 1 / 64 * 1000;
    public static CLIENT_TIMEOUT = 8000; //time in ms
    public static UPDATE_INTERVAL = 1 / 25 * 1000; //updates interval in ms (ex. 1 / 20 * 1000 => 20 updates per secound)
    public static DISCONNECT_CHECK_INTERVAL = 1000; //time in ms
}