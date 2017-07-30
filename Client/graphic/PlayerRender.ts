import {Player} from "../../Common/utils/game/Player";
import {GameObject} from "../../Common/utils/game/GameObject";
import {GameObjectSpriteRender} from "../../Client/graphic/GameObjectSpriteRender";

export class PlayerRender extends GameObjectSpriteRender {
    private playerReference: Player;

    private nameText: PIXI.Text;
    private hpBar: PIXI.Graphics;

    constructor() {
        super();
    }

    public setObject(player: Player) {
        super.setObject(player as GameObject);
        this.playerReference = player;

         this.nameText = new PIXI.Text(this.playerReference.Name, {
             fontFamily: "Arial",
             fontSize: "12px",
             fill: "#ffffff"
        });
        this.nameText.anchor.set(0, 2);

        this.addChild(this.nameText);

        this.hpBar = new PIXI.Graphics;
        this.hpBar.beginFill(0xFF0000);
        this.hpBar.drawRect(0, -40, 40, 8);
        this.addChild(this.hpBar);
    }

    public update() {
        super.update();

        this.nameText.text = this.playerReference.Name;
        this.hpBar.scale.x = this.playerReference.HP / this.playerReference.MaxHP;
    }

    public destroy() {
        super.destroy();
    }
}