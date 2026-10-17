import { Graphics } from "pixi.js";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectRender } from "./GameObjectRender";
import { presentationPhase } from "./AnimationClock";

/** Geometry is built once; animation changes transforms and alpha only, with no per-bullet filters. */
export class ProjectileRender extends GameObjectRender {
    private readonly glow = new Graphics();
    private readonly tail = new Graphics();
    private readonly core = new Graphics();
    private elapsedMs = 0;
    private phase = 0;

    constructor() {
        super();
        this.addChild(this.glow, this.tail, this.core);
    }

    public setObject(object: GameObject): void {
        super.setObject(object);
        this.phase = presentationPhase(object.ID);
        this.glow.clear();
        this.tail.clear();
        this.core.clear();
        if (object.SpriteName === "bluebolt") {
            this.glow.ellipse(-5, 0, 19, 7).fill({ color: 0x6adaef, alpha: 0.16 });
            this.tail.poly([12, 0, -27, -3, -18, 0, -27, 3]).fill({ color: 0x61cada, alpha: 0.65 });
            this.core.poly([12, 0, -3, -3, -10, 0, -3, 3]).fill(0xbaf9f1);
            this.core.moveTo(-11, 0).lineTo(8, 0).stroke({ color: 0xf4ffdf, width: 1.5 });
        } else if (object.SpriteName === "fireball") {
            this.glow.circle(0, 0, 7).fill({ color: 0xffba81, alpha: 0.15 });
            this.tail.poly([1, -2.5, -13, 0, 1, 2.5]).fill({ color: 0xff8b62, alpha: 0.55 });
            this.core.circle(0, 0, 3.3).fill(0xffc183).circle(0.5, -0.2, 1.6).fill(0xfff2c4);
        } else {
            this.glow.circle(0, 0, 10).fill({ color: 0xffb85e, alpha: 0.13 });
            this.tail.poly([2, -4, -23, 0, 2, 4]).fill({ color: 0xff9655, alpha: 0.3 });
            this.tail.poly([1, -2.2, -15, 0, 1, 2.2]).fill({ color: 0xffd98c, alpha: 0.8 });
            this.core.circle(0, 0, 5).fill(0xffb85e).circle(0.8, -0.3, 2.7).fill(0xfff6d4);
        }
    }

    public update(deltaMs: number = 1000 / 60): void {
        super.update(deltaMs);
        if (Number.isFinite(deltaMs) && deltaMs > 0) this.elapsedMs += deltaMs;
        const pulse = Math.sin(this.elapsedMs / 60 + this.phase);
        this.glow.scale.set(1 + pulse * 0.1);
        this.tail.scale.x = 1 + pulse * 0.12;
        this.tail.alpha = 0.9 + pulse * 0.1;
    }
}
