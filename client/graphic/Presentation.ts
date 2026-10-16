import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { ResourceType } from "./ResourceManifest";

export type PresentationKind = "actor" | "animation" | "sprite";

export function presentationKind(object: GameObject, resourceType: ResourceType): PresentationKind {
    if (object instanceof Actor) return "actor";
    return resourceType === ResourceType.ANIMATION || resourceType === ResourceType.OCTAGONAL_ANIMATION
        ? "animation"
        : "sprite";
}

/** Preserve the 60 FPS response while making the result depend on elapsed time. */
export function smoothingFactor(alphaAt60Fps: number, deltaMs: number): number {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
    return 1 - Math.pow(1 - alphaAt60Fps, deltaMs / (1000 / 60));
}
