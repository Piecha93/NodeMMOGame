import {GameObjectRender} from "./GameObjectRender";
import {GameObject} from "../../common/game_utils/game/objects/GameObject";
import {ResourcesLoader, Resource, ResourceType} from "../graphic/ResourcesLoader";
import {Actor} from "../../common/game_utils/game/objects/Actor";

export class GameObjectAnimationRender extends GameObjectRender {
    private animation: PIXI.extras.AnimatedSprite;

    protected static Tags: Array<string> = ["U", "UR","R","DR","D","DL","L","UL"];

    constructor() {
        super();
    }

    public setObject(gameObject: GameObject) {
        super.setObject(gameObject);

        this.animation = new PIXI.extras.AnimatedSprite(this.getAnimationTextures());

        this.updateAnimationTextures();

        this.addChild(this.animation);

        this.animation.animationSpeed = 0.2;
        this.animation.play();

        this.animation.width = this.objectRef.Transform.Width;
        this.animation.height = this.objectRef.Transform.Height;

        this.animation.anchor.set(0.5, 0.5);
    }

    public update() {
        super.update();

        this.updateAnimationTextures();

        this.animation.width = this.objectRef.Transform.Width;
        this.animation.height = this.objectRef.Transform.Height;
    }

    private updateAnimationTextures() {
        this.animation.textures = this.getAnimationTextures();
    }

    private getAnimationTextures(): Array<PIXI.Texture> {
        let resource: Resource = ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);

        if(resource.type == ResourceType.OCTAGONAL_ANIMATION) {
            let actor: Actor = (this.objectRef as Actor);
            let resource: Resource = ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);
            let animationDirection = GameObjectAnimationRender.Tags[actor.FaceDirection - 1];

            return resource.textures.get(animationDirection);
        } else {
            return resource.textures.get(this.objectRef.SpriteName);
        }
    }

    public destroy() {
        super.destroy();
        this.animation.destroy();
    }
}