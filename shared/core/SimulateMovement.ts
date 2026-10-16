import { Player } from "../game_utils/game/objects/Player";
import { CollisionsSystem } from "../game_utils/physics/CollisionsSystem";

export function simulateMovement(
    player: Player,
    collisions: CollisionsSystem,
    delta: number,
    reindex: () => void,
): void {
    player.updatePosition(delta);
    player.updateColliders();
    collisions.update();
    collisions.updateCollisionsForGameObject(player);
    reindex();
    player.updateColliders();
    collisions.update();
}
