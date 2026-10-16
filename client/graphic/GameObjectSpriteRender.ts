import { Sprite, Texture } from "pixi.js";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectRender } from "../graphic/GameObjectRender";
import { ResourcesLoader } from "./ResourcesLoader";

export class GameObjectSpriteRender extends GameObjectRender {
    protected sprite: Sprite | null = null;

    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        super.setObject(gameObjectReference);

        this.sprite = new Sprite(this.getTexture());
        this.addChild(this.sprite);

        this.sprite.setSize(this.objectRef.Transform.ScaleX, this.objectRef.Transform.ScaleY);

        this.sprite.anchor.set(0.5);
    }

    public update(deltaMs: number = 1000 / 60) {
        super.update(deltaMs);
        if (!this.sprite) return;

        const texture = this.getTexture();
        if (this.sprite.texture !== texture) {
            this.sprite.texture = texture;
        }

        this.sprite.setSize(this.objectRef.Transform.ScaleX, this.objectRef.Transform.ScaleY);
    }

    private getTexture(): Texture {
        const resource = ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);
        if (!resource?.texture) {
            throw new Error(`Missing sprite texture: ${this.objectRef.SpriteName}`);
        }

        return resource.texture;
    }
}
