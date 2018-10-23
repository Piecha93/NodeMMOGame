export enum Origin {
    CLIENT,
    SERVER,
    UNKNOWN
}

function getOrigin(): Origin {
    if(typeof window !== 'undefined') {
        return Origin.CLIENT;
    } else {
        return Origin.SERVER;
    }
}

export class SharedConfig {
    public static chunkSize: number = 32 * 40;
    public static numOfChunksX: number = 5;
    public static numOfChunksY: number = 5;

    public static chunkDeactivationTime = 10000;

    public static ORIGIN: Origin = getOrigin();

    public static get IS_SERVER(): boolean {
        return SharedConfig.ORIGIN == Origin.SERVER;
    }

    public static get IS_CLIENT(): boolean {
        return SharedConfig.ORIGIN == Origin.CLIENT;
    }
}