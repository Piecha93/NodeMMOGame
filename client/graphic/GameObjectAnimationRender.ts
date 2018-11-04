import {GameObjectRender} from "./GameObjectRender";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {ResourcesLoader, Resource, ResourceType} from "../graphic/ResourcesLoader";
import {Actor} from "../../shared/game_utils/game/objects/Actor";

export class GameObjectAnimationRender extends GameObjectRender {
    private animation: PIXI.extras.AnimatedSprite;

    private lastDirectionKey: string = "D";

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

        this.animation.width = this.objectRef.Transform.ScaleX;
        this.animation.height = this.objectRef.Transform.ScaleY;

        this.animation.anchor.set(0.5, 0.5);
    }

    public update() {
        super.update();

        this.updateAnimationTextures();

        this.animation.width = this.objectRef.Transform.ScaleX;
        this.animation.height = this.objectRef.Transform.ScaleY;
    }

    private updateAnimationTextures() {
        this.animation.textures = this.getAnimationTextures();
    }

    private getAnimationTextures(): Array<PIXI.Texture> {
        let resource: Resource = ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);

        if(resource.type == ResourceType.OCTAGONAL_ANIMATION) {
            let actor: Actor = (this.objectRef as Actor);
            let resource: Resource = ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);

            this.lastDirectionKey = this.directonsToDirectionKey(actor.Horizontal, actor.Vertical);

            return resource.textures.get(this.lastDirectionKey);
        } else {
            return resource.textures.get(this.objectRef.SpriteName);
        }
    }

    private directonsToDirectionKey(horizontal: number, vertical: number): string {
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

    public destroy() {
        super.destroy();
        this.animation.destroy();
    }
}