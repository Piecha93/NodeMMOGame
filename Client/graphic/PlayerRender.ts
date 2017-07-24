import {GameObjectRender} from "./GameObjectRender";
import {Player} from "../../Common/utils/game/Player";
import {GameObject} from "../../Common/utils/game/GameObject";

export class PlayerRender extends GameObjectRender {
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
        this.nameText.anchor.set(0.5, 2.75);

        this.sprite.addChild(this.nameText);

        this.hpBar = new PIXI.Graphics;
        this.hpBar.beginFill(0xFF0000);
        this.hpBar.drawRect(-20, -50, 40, 8);
        this.sprite.addChild(this.hpBar);

    }

    public update() {
        super.update();

        this.nameText.text = this.playerReference.Name;

        this.hpBar.scale.x = this.playerReference.HP / 100;
    }
}