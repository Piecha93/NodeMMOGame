import { Container, Graphics, Text } from "pixi.js";
import { ExpeditionState } from "../../shared/gameplay/Expedition";

/** Floor markings remain presentation; collecting a core is decided by the server. */
export class ExpeditionMarkers extends Container {
    private signature = "";
    public setState(state: ExpeditionState): void {
        const signature = JSON.stringify([state.home, state.collected === state.total, state.camps]);
        if (signature === this.signature) return;
        this.signature = signature;
        for (const child of this.removeChildren()) child.destroy({ children: true });
        const home = new Container();
        home.position.set(state.home.x, state.home.y);
        home.addChild(
            new Graphics()
                .circle(0, 0, state.home.radius)
                .fill({ color: 0x8fcba9, alpha: 0.08 })
                .stroke({ color: 0x8fcba9, width: 2, alpha: 0.75 }),
        );
        home.addChild(
            this.createLabel(
                state.collected === state.total ? "OBÓZ · WRÓĆ TUTAJ" : "OBÓZ · BEZPIECZNY POWRÓT",
                -state.home.radius - 26,
                0xb8e8cc,
            ),
        );
        this.addChild(home);
        for (const camp of state.camps) {
            const marker = new Container();
            marker.position.set(camp.x, camp.y);
            const color = camp.status === "collected" ? 0x84a68a : camp.status === "ready" ? 0xb5dce5 : 0xc89b70;
            marker.addChild(
                new Graphics().circle(0, 0, 92).fill({ color, alpha: 0.055 }).stroke({ color, width: 2, alpha: 0.6 }),
            );
            marker.addChild(this.createLabel(camp.name, -122, color));
            marker.addChild(
                this.createLabel(
                    camp.status === "collected"
                        ? "ODZYSKANY"
                        : camp.status === "ready"
                          ? "PODEJDŹ PO RDZEŃ"
                          : `STRAŻNICY: ${camp.guardsRemaining}`,
                    -102,
                    color,
                    10,
                ),
            );
            this.addChild(marker);
        }
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
