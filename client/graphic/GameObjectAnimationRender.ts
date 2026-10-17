import { AnimatedSprite, Texture } from "pixi.js";
import { GameObjectRender } from "./GameObjectRender";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { ResourcesLoader, Resource, ResourceType } from "../graphic/ResourcesLoader";
import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { AnimationClock } from "./AnimationClock";

type AnimationState = {
    key: string;
    textures: Texture[];
};

export class GameObjectAnimationRender extends GameObjectRender {
    protected animation: AnimatedSprite | null = null;
    private animationKey: string = "";
    private animationResource = "";
    private animationScale = 1;
    private readonly animationClock = new AnimationClock();

    private lastDirectionKey: string = "D";

    constructor() {
        super();
    }

    public setObject(gameObject: GameObject) {
        super.setObject(gameObject);

        const animationState = this.getAnimationState();
        this.animationKey = animationState.key;
        this.animationResource = this.objectRef.SpriteName;
        this.updateAnimationScale();
        this.animationClock.reset();
        this.animation = new AnimatedSprite({ textures: animationState.textures, autoUpdate: false, autoPlay: false });

        this.addChild(this.animation);

        this.updateAnimationSize();

        this.animation.anchor.set(0.5);
    }

    public update(deltaMs: number = 1000 / 60) {
        super.update(deltaMs);
        if (!this.animation) return;

        this.updateAnimationTextures();
        this.animationClock.advance(deltaMs);
        const actor = this.objectRef;
        const fps = actor instanceof Actor && actor.Horizontal === 0 && actor.Vertical === 0 ? 6 : 12;
        this.animation.gotoAndStop(this.animationClock.frame(this.animation.totalFrames, fps));
        this.updateAnimationSize();
    }

    private updateAnimationSize(): void {
        // The generated sheets include transparent cell padding. Their painted body
        // remains readable without changing the authoritative collider dimensions.
        this.animation?.setSize(
            this.objectRef.Transform.ScaleX * this.animationScale,
            this.objectRef.Transform.ScaleY * this.animationScale,
        );
    }

    private updateAnimationScale(): void {
        this.animationScale =
            this.animationResource.startsWith("wanderer_") || this.animationResource.startsWith("wraith_") ? 1.35 : 1;
    }

    private updateAnimationTextures() {
        if (!this.animation) return;
        const animationState = this.getAnimationState();
        if (animationState.key === this.animationKey) {
            return;
        }

        this.animation.textures = animationState.textures;
        this.animationKey = animationState.key;
        if (this.animationResource !== this.objectRef.SpriteName) {
            this.animationResource = this.objectRef.SpriteName;
            this.updateAnimationScale();
            this.animationClock.reset();
        }
    }

    private getAnimationState(): AnimationState {
        const resource: Resource = ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);
        if (!resource) {
            throw new Error(`Missing animation resource: ${this.objectRef.SpriteName}`);
        }

        if (resource.type == ResourceType.OCTAGONAL_ANIMATION) {
            const actor = this.objectRef;
            if (!(actor instanceof Actor)) throw new Error("Directional animation requires an actor");

            this.lastDirectionKey = this.directionsToDirectionKey(actor.Horizontal, actor.Vertical);

            return this.createAnimationState(resource, this.lastDirectionKey);
        } else {
            return this.createAnimationState(resource, resource.name);
        }
    }

    private createAnimationState(resource: Resource, frameSet: string): AnimationState {
        const textures = resource.textures.get(frameSet);
        if (!textures?.length) {
            throw new Error(`Missing animation frames: ${resource.name}/${frameSet}`);
        }

        return {
            key: `${resource.name}:${frameSet}`,
            textures,
        };
    }

    private directionsToDirectionKey(horizontal: number, vertical: number): string {
        let dir: string = "";
        if (horizontal == -1) {
            dir += "U";
        } else if (horizontal == 1) {
            dir += "D";
        }

        if (vertical == -1) {
            dir += "L";
        } else if (vertical == 1) {
            dir += "R";
        }

        if (dir == "") {
            dir = this.lastDirectionKey;
        }

        return dir;
    }
}
