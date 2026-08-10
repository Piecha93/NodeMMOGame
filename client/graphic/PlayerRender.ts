import {Graphics, Text} from "pixi.js";
import {Player} from "../../shared/game_utils/game/objects/Player";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {GameObjectAnimationRender} from "../graphic/GameObjectAnimationRender";

export class PlayerRender extends GameObjectAnimationRender {
    private playerReference: Player;

    private nameText: Text;
    private hpBar: Graphics;

    constructor() {
        super();
    }

    public setObject(player: Player) {
        super.setObject(player as GameObject);
        this.playerReference = player;

        this.nameText = new Text({
            text: this.playerReference.Name,
            style: {
                fontFamily: "Arial",
                fontSize: 12,
                fill: 0xffffff
            }
        });
        this.nameText.anchor.set(0.5, 4);

        this.addChild(this.nameText);

        this.hpBar = new Graphics()
            .rect(
                -this.objectRef.Transform.ScaleX / 2,
                -this.objectRef.Transform.ScaleY / 2 - 13,
                this.objectRef.Transform.ScaleX,
                7
            )
            .fill(0xFF0000);


        this.addChild(this.hpBar);
    }

    public update() {
        super.update();

        this.nameText.text = this.playerReference.Name;
        this.hpBar.scale.x = this.playerReference.HP / this.playerReference.MaxHP;
    }
}
