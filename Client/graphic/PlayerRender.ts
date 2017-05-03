import {GameObjectRender} from "./GameObjectRender";
import {Renderer} from "./Renderer";
import {Player} from "../../Common/utils/Player";
import {GameObject} from "../../Common/utils/GameObject";

export class PlayerRender extends GameObjectRender {
    private nameText: Phaser.Text;
    private playerReference: Player;

    constructor() {
        super();
    }

    public setObject(player: Player) {
        super.setObject(player as GameObject);
        this.playerReference = player;

        this.nameText = Renderer.phaserGame.add.text(0, 0, this.playerReference.Name, {
            font: "bold 11px Arial",
            fill: "#ffffff"
        });
        this.nameText.anchor.setTo(0.5, 2);

        this.sprite.addChild(this.nameText);
    }

    public render() {
        super.render();
        if(this.sprite) {
            this.nameText.text = this.playerReference.Name;
        }
    }
}