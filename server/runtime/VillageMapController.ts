import { GameCore } from "../../shared/GameCore";
import { VILLAGE_OBSTACLES } from "../../shared/gameplay/VillageMap";

/** Static cover uses ordinary persistent walls, so chunk sleep and prediction stay consistent. */
export class VillageMapController {
    private started = false;
    private disposed = false;
    private readonly obstacleIds = new Set<string>();

    constructor(private readonly core: GameCore) {
        if (!core.Runtime.isServer || core.Runtime.config.performanceMode) {
            throw new Error("Village scenery belongs to the normal server world");
        }
    }

    start(): void {
        if (this.disposed) throw new Error("Village map has been disposed");
        if (this.started) return;
        this.started = true;
        for (const rect of VILLAGE_OBSTACLES) {
            const obstacle = this.core.ObjectsFactory.instantiateWithPosition(
                "Wall",
                [rect.x + rect.width / 2, rect.y + rect.height / 2],
                [rect.width, rect.height],
                undefined,
                undefined,
                (object) => {
                    object.SpriteName = "none";
                },
            );
            this.obstacleIds.add(obstacle.ID);
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        // Sleeping chunks own serialized copies with the same ids. Reload before cleanup.
        for (const column of this.core.ChunksManager.Chunks) {
            for (const chunk of column) chunk.reload();
        }
        for (const id of this.obstacleIds) this.core.ObjectsManager.destroy(id);
        this.obstacleIds.clear();
    }
}
