import { Container, Graphics } from "pixi.js";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectRender } from "./GameObjectRender";
import { presentationPhase } from "./AnimationClock";

/** Pickups are vector shapes: no downloaded textures, filters or secondary ticker. */
export class LootRender extends GameObjectRender {
    private readonly body = new Container();
    private readonly halo = new Graphics();
    private readonly shadow = new Graphics().ellipse(0, 7, 6, 2).fill({ color: 0x071e21, alpha: 0.3 });
    private elapsedMs = 0;
    private phase = 0;

    constructor() {
        super();
        this.addChild(this.shadow, this.halo, this.body);
    }

    public setObject(object: GameObject): void {
        super.setObject(object);
        this.phase = presentationPhase(object.ID);
        const item = new Graphics();
        if (object.SpriteName === "loot_coin") {
            this.halo.circle(0, 0, 10).fill({ color: 0xf5c464, alpha: 0.1 });
            item.ellipse(0, 0, 5, 6).fill(0xd59a38).stroke({ color: 0xffda7e, width: 1.5 });
            item.moveTo(0, -3).lineTo(0, 3).stroke({ color: 0xffebad, width: 1.5 });
        } else if (object.SpriteName === "loot_heal") {
            this.halo.circle(0, 0, 10).fill({ color: 0xef8a86, alpha: 0.12 });
            item.roundRect(-4.5, -3, 9, 10, 3).fill(0xad4c55).stroke({ color: 0xf0beb1, width: 1 });
            item.rect(-3, -6, 6, 3).fill(0xccad7c);
            item.rect(-2.5, 0, 5, 2).fill(0xffdfc6).rect(-1, -1.5, 2, 5).fill(0xffdfc6);
            item.rect(-3, -1, 1, 4).fill({ color: 0xffffff, alpha: 0.3 });
        } else {
            this.halo.circle(0, 0, 11).fill({ color: 0x75dfc5, alpha: 0.12 });
            item.poly([0, -8, 5, -2, 3, 5, 0, 8, -4, 3, -5, -2]).fill(0x58b8b2);
            item.poly([0, -8, 0, 8, -4, 3, -5, -2]).fill(0xa9f0d9);
            item.moveTo(0, -7).lineTo(4, -2).stroke({ color: 0xebffe8, width: 1 });
        }
        this.body.addChild(item);
        this.update(0);
    }

    public update(deltaMs: number = 1000 / 60): void {
        super.update(deltaMs);
        if (Number.isFinite(deltaMs) && deltaMs > 0) this.elapsedMs += deltaMs;
        const time = this.elapsedMs / 1000;
        const wave = Math.sin(time * 3 + this.phase);
        this.body.y = -2 + wave * 2.5;
        this.body.rotation = Math.sin(time * 1.5 + this.phase) * 0.12;
        this.shadow.scale.x = 1 - (wave + 1) * 0.09;
        this.halo.alpha = 0.7 + (wave + 1) * 0.15;
        this.halo.scale.set(1 + Math.sin(time * 2 + this.phase) * 0.12);
    }
}
