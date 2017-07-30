import {GameObjectRender} from "./GameObjectRender";
import {GameObject} from "../../Common/utils/game/GameObject";

export class GameObjectAnimationRender extends GameObjectRender {
    private textures: Array<PIXI.Texture> = new Array<PIXI.Texture>();
    private animation: PIXI.extras.AnimatedSprite;

    constructor() {
        super();
    }

    public setObject(gameObject: GameObject) {
        super.setObject(gameObject);

        for (let i = 0; i < 4; i++) {
            let texture: PIXI.Texture = PIXI.Texture.fromFrame(this.objectReference.SpriteName + '_' + (i) + '.png');
            this.textures.push(texture);
        }

        this.animation = new PIXI.extras.AnimatedSprite(this.textures);

        this.addChild(this.animation);

        this.animation.animationSpeed = 0.5;
        this.animation.play();

        this.animation.width = this.objectReference.Transform.Width;
        this.animation.height = this.objectReference.Transform.Height;
    }

    public update() {
        super.update();
    }

    public destroy() {
        this.animation.destroy();
    }
}