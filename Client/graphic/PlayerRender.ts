import {GameObjectRender} from "./GameObjectRender";
import {Renderer} from "./Renderer";
import {Player} from "../../Common/utils/game/Player";
import {GameObject} from "../../Common/utils/game/GameObject";

export class PlayerRender extends GameObjectRender {
    private nameText: PIXI.Text;
    private playerReference: Player;

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
    }

    public update() {
        super.update();
        if(this.sprite) {
            this.nameText.text = this.playerReference.Name;
        }
    }
}