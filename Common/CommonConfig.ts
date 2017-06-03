export enum Origin {
    CLIENT,
    SERVER,
    UNKNOWN
}

export class CommonConfig {
    public static ORIGIN: Origin = Origin.UNKNOWN;
}