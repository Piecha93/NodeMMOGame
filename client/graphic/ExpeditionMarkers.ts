import { Container, Graphics, Text } from "pixi.js";
import { ExpeditionState } from "../../shared/gameplay/Expedition";

/** The campfire is a landmark; round progress and healing belong to the server. */
export class ExpeditionMarkers extends Container {
    private signature = "";
    public setState(state: ExpeditionState): void {
        const resting = state.waveStage === "preparing" || state.waveStage === "rest";
        const signature = JSON.stringify([state.home.x, state.home.y, resting]);
        if (signature === this.signature) return;
        this.signature = signature;
        for (const child of this.removeChildren()) child.destroy({ children: true });
        const home = new Container();
        home.position.set(state.home.x, state.home.y);
        home.addChild(
            new Graphics()
                .ellipse(0, 2, 43, 29)
                .fill({ color: 0xe8a951, alpha: 0.1 })
                .ellipse(0, 6, 20, 9)
                .fill({ color: 0x18221b, alpha: 0.5 })
                .moveTo(-13, 8)
                .lineTo(13, -2)
                .stroke({ color: 0x79513a, width: 7 })
                .moveTo(13, 8)
                .lineTo(-13, -2)
                .stroke({ color: 0x9b6943, width: 6 })
                .poly([0, -28, 13, -6, 9, 6, -10, 6, -14, -5, -7, -18, -5, -8])
                .fill(0xe58b38)
                .poly([0, -16, 7, -2, 3, 6, -5, 4, -6, -3])
                .fill(0xf7cd70),
        );
        home.addChild(this.createLabel(resting ? "OGNISKO · CHWILA ODDECHU" : "POLANA", -50, 0xe3c38b, 10));
        this.addChild(home);
    }

    private createLabel(text: string, y: number, color: number, size = 12): Text {
        const label = new Text({
            text,
            style: {
                fontFamily: "Arial",
                fontSize: size,
                fontWeight: "bold",
                fill: color,
                stroke: { color: 0x1b2021, width: 4 },
            },
        });
        label.anchor.set(0.5, 0);
        label.y = y;
        return label;
    }
}
