import { Origin } from "./Origin";

export interface WorldOptions {
    role?: Origin;
    enableDebugActions?: boolean;
    cooperative?: boolean;
    performanceMode?: boolean;
    chunkSize?: number;
    numOfChunksX?: number;
    numOfChunksY?: number;
    chunkDeactivationTime?: number;
    fixedDeltaMs?: number;
    maxCatchUpSteps?: number;
    clock?: () => number;
    random?: () => number;
}

export class WorldContext {
    readonly config: Readonly<Required<Omit<WorldOptions, "clock" | "random">>>;
    readonly clock: () => number;
    readonly random: () => number;
    tick = 0;
    timeMs = 0;

    constructor(options: WorldOptions = {}) {
        const config = {
            role: options.role ?? Origin.SERVER,
            enableDebugActions: options.enableDebugActions ?? false,
            cooperative: options.cooperative ?? false,
            performanceMode: options.performanceMode ?? false,
            chunkSize: options.chunkSize ?? 1280,
            numOfChunksX: options.numOfChunksX ?? 5,
            numOfChunksY: options.numOfChunksY ?? 5,
            chunkDeactivationTime: options.chunkDeactivationTime ?? 1000,
            fixedDeltaMs: options.fixedDeltaMs ?? 1000 / 64,
            maxCatchUpSteps: options.maxCatchUpSteps ?? 8,
        };
        for (const [key, value] of Object.entries(config)) {
            if (typeof value === "number" && key !== "role" && (!Number.isFinite(value) || value <= 0)) {
                throw new RangeError(`Invalid world setting '${key}'`);
            }
        }
        if (
            ![Origin.SERVER, Origin.CLIENT].includes(config.role) ||
            !Number.isInteger(config.numOfChunksX) ||
            !Number.isInteger(config.numOfChunksY) ||
            !Number.isInteger(config.maxCatchUpSteps)
        ) {
            throw new RangeError("Invalid world role or grid dimensions");
        }
        this.config = Object.freeze(config);
        this.clock = options.clock ?? (() => Date.now());
        this.random = options.random ?? Math.random;
    }

    get role(): Origin {
        return this.config.role;
    }
    get isServer(): boolean {
        return this.role === Origin.SERVER;
    }
    get isClient(): boolean {
        return this.role === Origin.CLIENT;
    }
}
