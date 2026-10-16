import { Graphics, Text } from "pixi.js";
import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectAnimationRender } from "../graphic/GameObjectAnimationRender";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";

export class PlayerRender extends GameObjectAnimationRender {
    private playerReference: Actor | null = null;

    private nameText: Text | null = null;
    private hpBar: Graphics | null = null;

    constructor() {
        super();
    }

    public setObject(player: GameObject) {
        if (!(player instanceof Actor)) throw new Error("Actor presentation requires an actor");
        super.setObject(player);
        this.playerReference = player;
        if (player instanceof Enemy) this.tint = 0xd9947f;

        this.nameText = new Text({
            text: this.playerReference.Name,
            style: {
                fontFamily: "Arial",
                fontSize: 12,
                fill: 0xffffff,
            },
        });
        this.nameText.anchor.set(0.5, 4);

        this.addChild(this.nameText);

        this.hpBar = new Graphics()
            .rect(
                -this.objectRef.Transform.ScaleX / 2,
                -this.objectRef.Transform.ScaleY / 2 - 13,
                this.objectRef.Transform.ScaleX,
                7,
            )
            .fill(0xff0000);

        this.addChild(this.hpBar);
    }

    public update(deltaMs: number = 1000 / 60) {
        super.update(deltaMs);
        if (!this.playerReference || !this.nameText || !this.hpBar) return;

        this.nameText.text = this.playerReference.Name;
        this.hpBar.scale.x = this.playerReference.MaxHP > 0 ? this.playerReference.HP / this.playerReference.MaxHP : 0;
    }
}
