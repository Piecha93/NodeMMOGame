import { GameCore } from "../../shared/GameCore";

export function seedDemoWorld(core: GameCore, random: () => number = core.Runtime.random): void {
    const config = core.Runtime.config;
    const coordinate = (chunks: number): number =>
        Math.round((Math.floor(random() * (chunks * config.chunkSize - 100)) + 50) / 32) * 32;

    for (let index = 0; index < 1000; index++) {
        core.ObjectsFactory.instantiateWithPosition("Wall", [
            coordinate(config.numOfChunksX),
            coordinate(config.numOfChunksY),
        ]);
    }
}
