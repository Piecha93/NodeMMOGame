import { Graphics } from "pixi.js";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectRender } from "./GameObjectRender";
import { presentationPhase } from "./AnimationClock";

/** Geometry is built once; animation changes transforms and alpha only, with no per-bullet filters. */
export class ProjectileRender extends GameObjectRender {
    private readonly glow = new Graphics().circle(0, 0, 10).fill({ color: 0xffb85e, alpha: 0.13 });
    private readonly tail = new Graphics()
        .poly([2, -4, -23, 0, 2, 4])
        .fill({ color: 0xff9655, alpha: 0.3 })
        .poly([1, -2.2, -15, 0, 1, 2.2])
        .fill({ color: 0xffd98c, alpha: 0.8 });
    private elapsedMs = 0;
    private phase = 0;

    constructor() {
        super();
        this.addChild(this.glow, this.tail);
        this.addChild(new Graphics().circle(0, 0, 5).fill(0xffb85e).circle(0.8, -0.3, 2.7).fill(0xfff6d4));
    }

    public setObject(object: GameObject): void {
        super.setObject(object);
        this.phase = presentationPhase(object.ID);
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
