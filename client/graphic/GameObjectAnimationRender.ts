import {AnimatedSprite, Texture} from "pixi.js";
import {GameObjectRender} from "./GameObjectRender";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {ResourcesLoader, Resource, ResourceType} from "../graphic/ResourcesLoader";
import {Actor} from "../../shared/game_utils/game/objects/Actor";

type AnimationState = {
    key: string;
    textures: Texture[];
};

export class GameObjectAnimationRender extends GameObjectRender {
    private animation: AnimatedSprite;
    private animationKey: string;

    private lastDirectionKey: string = "D";

    constructor() {
        super();
    }

    public setObject(gameObject: GameObject) {
        super.setObject(gameObject);

        const animationState = this.getAnimationState();
        this.animationKey = animationState.key;
        this.animation = new AnimatedSprite(animationState.textures);

        this.addChild(this.animation);

        this.animation.animationSpeed = 0.2;
        this.animation.play();

        this.animation.setSize(this.objectRef.Transform.ScaleX, this.objectRef.Transform.ScaleY);

        this.animation.anchor.set(0.5);
    }

    public update() {
        super.update();

        this.updateAnimationTextures();

        this.animation.setSize(this.objectRef.Transform.ScaleX, this.objectRef.Transform.ScaleY);
    }

    private updateAnimationTextures() {
        const animationState = this.getAnimationState();
        if (animationState.key === this.animationKey) {
            return;
        }

        const animationProgress = this.animation.totalFrames <= 1
            ? 0
            : this.animation.currentFrame / (this.animation.totalFrames - 1);
        const currentFrame = Math.round(animationProgress * (animationState.textures.length - 1));
        const wasPlaying = this.animation.playing;

        this.animation.textures = animationState.textures;
        this.animationKey = animationState.key;

        if (wasPlaying) {
            this.animation.gotoAndPlay(currentFrame);
        } else {
            this.animation.gotoAndStop(currentFrame);
        }
    }

    private getAnimationState(): AnimationState {
        const resource: Resource = ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);
        if (!resource) {
            throw new Error(`Missing animation resource: ${this.objectRef.SpriteName}`);
        }

        if(resource.type == ResourceType.OCTAGONAL_ANIMATION) {
            const actor: Actor = this.objectRef as Actor;

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
            textures
        };
    }

    private directionsToDirectionKey(horizontal: number, vertical: number): string {
        let dir: string = "";
        if(horizontal == -1) {
            dir += "U";
        } else if(horizontal == 1) {
            dir += "D";
        }

        if(vertical == -1) {
            dir += "L";
        } else if(vertical == 1) {
            dir += "R";
        }

        if(dir == "") {
            dir = this.lastDirectionKey;
        }

        return dir;
    }

}
