import { Origin } from "./core/Origin";
export { Origin } from "./core/Origin";

function getOrigin(): Origin {
    if ("window" in globalThis) {
        return Origin.CLIENT;
    } else {
        return Origin.SERVER;
    }
}

export class SharedConfig {
    public static chunkSize: number = 32 * 40;
    public static numOfChunksX: number = 5;
    public static numOfChunksY: number = 5;

    public static chunkDeactivationTime = 1000;

    public static ORIGIN: Origin = getOrigin();

    public static get IS_SERVER(): boolean {
        return SharedConfig.ORIGIN == Origin.SERVER;
    }

    public static get IS_CLIENT(): boolean {
        return SharedConfig.ORIGIN == Origin.CLIENT;
    }
}
