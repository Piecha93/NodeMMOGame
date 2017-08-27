import {GameObjectRender} from "./GameObjectRender";
import {GameObject} from "../../Common/utils/game/GameObject";

export class GameObjectAnimationRender extends GameObjectRender {
    private textures: Array<PIXI.Texture> = [];
    private animation: PIXI.extras.AnimatedSprite;

    constructor() {
        super();
    }

    public setObject(gameObject: GameObject) {
        super.setObject(gameObject);

        for (let i = 0; i < 4; i++) {
            let texture: PIXI.Texture = PIXI.Texture.fromFrame(this.objectRef.SpriteName + '_' + (i) + '.png');
            this.textures.push(texture);
        }

        this.animation = new PIXI.extras.AnimatedSprite(this.textures);

        this.addChild(this.animation);

        this.animation.animationSpeed = 0.5;
        this.animation.play();

        this.animation.width = this.objectRef.Transform.Width;
        this.animation.height = this.objectRef.Transform.Height;

        this.animation.anchor.set(0.5, 0.5);
    }

    public update() {
        super.update();

        this.animation.width = this.objectRef.Transform.Width;
        this.animation.height = this.objectRef.Transform.Height;
    }

    public destroy() {
        super.destroy();
        this.animation.destroy();
    }
}