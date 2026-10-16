import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { ResourceType } from "./ResourceManifest";

export type PresentationKind = "actor" | "projectile" | "animation" | "sprite";

export function presentationKind(object: GameObject, resourceType: ResourceType): PresentationKind {
    if (object instanceof Actor) return "actor";
    if (object instanceof FireBall && object.SpriteName === "flame") return "projectile";
    return resourceType === ResourceType.ANIMATION || resourceType === ResourceType.OCTAGONAL_ANIMATION
        ? "animation"
        : "sprite";
}

/** Preserve the 60 FPS response while making the result depend on elapsed time. */
export function smoothingFactor(alphaAt60Fps: number, deltaMs: number): number {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
    return 1 - Math.pow(1 - alphaAt60Fps, deltaMs / (1000 / 60));
}
