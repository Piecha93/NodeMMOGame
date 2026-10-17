import { Graphics } from "pixi.js";
import { GameObjectRender } from "./GameObjectRender";

/** A small animated campsite, using reusable vector shapes instead of a terrain entity per pixel. */
export class CampfireRender extends GameObjectRender {
    private readonly glow = new Graphics().ellipse(0, 8, 50, 24).fill({ color: 0xffca70, alpha: 0.12 });
    private readonly fire = new Graphics()
        .poly([-10, 7, -12, -3, -6, -15, -4, -5, 2, -25, 9, -11, 12, 2, 8, 10])
        .fill(0xf49b4f)
        .poly([-5, 7, -4, -3, 1, -13, 6, 0, 4, 8])
        .fill(0xffe5a2);
    private elapsed = 0;

    constructor() {
        super();
        const stones = new Graphics();
        for (let index = 0; index < 8; index++) {
            const angle = (index * Math.PI) / 4;
            stones.ellipse(Math.cos(angle) * 22, 8 + Math.sin(angle) * 11, 6, 4).fill(index % 2 ? 0x70837b : 0x91a08b);
        }
        const logs = new Graphics()
            .moveTo(-15, 3)
            .lineTo(14, 13)
            .moveTo(-14, 13)
            .lineTo(14, 3)
            .stroke({ color: 0x67472f, width: 7 });
        this.addChild(this.glow, stones, logs, this.fire);
    }

    override update(deltaMs = 1000 / 60): void {
        super.update(deltaMs);
        this.elapsed += Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
        this.fire.scale.set(1 + Math.sin(this.elapsed / 130) * 0.07, 1 + Math.sin(this.elapsed / 93) * 0.1);
        this.glow.alpha = 0.8 + Math.sin(this.elapsed / 220) * 0.2;
    }
}
