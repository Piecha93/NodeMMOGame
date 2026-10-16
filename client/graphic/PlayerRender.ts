import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectAnimationRender } from "./GameObjectAnimationRender";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { ActorFeedback, presentationPhase } from "./AnimationClock";

function flashTint(color: number, amount: number): number {
    const mix = (component: number) => Math.round(component + (255 - component) * amount);
    return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}

export class PlayerRender extends GameObjectAnimationRender {
    private playerReference: Actor | null = null;

    private nameText: Text | null = null;
    private shadow: Graphics | null = null;
    private hitRing: Graphics | null = null;
    private hpBar: Container | null = null;
    private hpFill: Sprite | null = null;
    private hpTrail: Sprite | null = null;
    private feedback: ActorFeedback | null = null;
    private elapsedMs = 0;
    private phase = 0;
    private bodyColor = 0xffffff;
    private barWidth = 32;
    private previousRatio = -1;
    private previousTrail = -1;

    public setObject(player: GameObject): void {
        if (!(player instanceof Actor)) throw new Error("Actor presentation requires an actor");
        super.setObject(player);
        this.playerReference = player;
        this.feedback = new ActorFeedback(player.HP, player.MaxHP);
        this.phase = presentationPhase(player.ID);
        this.bodyColor = player.SpriteName.startsWith("template_")
            ? player instanceof Enemy
                ? 0xf6a49a
                : 0xb6e6df
            : 0xffffff;

        this.shadow = new Graphics().ellipse(0, 0, 10, 4).fill({ color: 0x10191b, alpha: 0.35 });
        this.shadow.y = player.Transform.ScaleY * 0.43;
        this.addChildAt(this.shadow, 0);
        if (!(player instanceof Enemy)) {
            const ring = new Graphics().ellipse(0, 0, 12, 5).stroke({ color: 0xa0dfd2, width: 1, alpha: 0.65 });
            ring.y = this.shadow.y;
            this.addChildAt(ring, 1);
        }

        // Benchmark enemies have no name; they must not allocate thousands of text textures.
        if (!(player instanceof Enemy) || player.Name.length > 0) this.createName(player.Name);

        if (!(player instanceof Enemy) || player.HP < player.MaxHP) this.createHealthBar(player);
        this.update(0);
    }

    public update(deltaMs: number = 1000 / 60): void {
        super.update(deltaMs);
        const player = this.playerReference;
        if (!player || !this.animation || !this.feedback) return;

        if (Number.isFinite(deltaMs) && deltaMs > 0) this.elapsedMs += deltaMs;
        this.feedback.update(player.HP, player.MaxHP, deltaMs);
        const hit = this.feedback.hit;
        const moving = player.HP > 0 && (player.Horizontal !== 0 || player.Vertical !== 0);
        const gait = Math.sin((this.elapsedMs / 1000) * Math.PI * 6);
        const bob = moving ? Math.abs(gait) * 1.6 : Math.sin(this.elapsedMs / 500 + this.phase) * 0.45;
        this.animation.y = player.HP > 0 ? -bob : 4;
        this.animation.scale.x *= 1 + hit * 0.12;
        this.animation.scale.y *= 1 - hit * 0.1 + (moving ? gait * 0.025 : 0);
        this.animation.tint = flashTint(this.bodyColor, hit * 0.9);
        this.animation.alpha = player.HP > 0 ? 1 : 0.4;
        this.animation.rotation = player.HP > 0 ? hit * 0.08 : -0.45;
        if (this.shadow) this.shadow.scale.x = 1 - Math.max(0, bob) * 0.045;

        if (hit > 0 && !this.hitRing) {
            this.hitRing = new Graphics().circle(0, 0, 12).stroke({ color: 0xffe8c3, width: 1.5 });
            this.addChild(this.hitRing);
        }
        if (this.hitRing) {
            this.hitRing.visible = hit > 0;
            this.hitRing.alpha = hit * 0.65;
            this.hitRing.scale.set(1 + (1 - hit) * 1.1);
        }

        if (!this.hpBar && player.HP < player.MaxHP) this.createHealthBar(player);
        if (this.hpBar && this.hpFill && this.hpTrail) {
            const ratio = player.MaxHP > 0 ? Math.max(0, player.HP / player.MaxHP) : 0;
            if (ratio !== this.previousRatio) {
                this.hpFill.width = this.barWidth * ratio;
                this.previousRatio = ratio;
            }
            if (this.feedback.trail !== this.previousTrail) {
                this.hpTrail.width = this.barWidth * this.feedback.trail;
                this.previousTrail = this.feedback.trail;
            }
            this.hpBar.visible = !(player instanceof Enemy) || (player.HP > 0 && player.HP < player.MaxHP);
        }
        if (!this.nameText && player.Name.length > 0) this.createName(player.Name);
        if (this.nameText && this.nameText.text !== player.Name) this.nameText.text = player.Name;
    }

    private createName(name: string): void {
        this.nameText = new Text({
            text: name,
            style: {
                fontFamily: "Arial",
                fontSize: 11,
                fill: this.playerReference instanceof Enemy ? 0xe4bcaf : 0xe9f7ee,
                stroke: { color: 0x172226, width: 3 },
            },
        });
        this.nameText.anchor.set(0.5, 1);
        this.nameText.y = -this.objectRef.Transform.ScaleY / 2 - 12;
        this.addChild(this.nameText);
    }

    private barSprite(color: number, width: number, height: number, x: number, y: number): Sprite {
        const sprite = new Sprite(Texture.WHITE);
        sprite.tint = color;
        sprite.setSize(width, height);
        sprite.position.set(x, y);
        return sprite;
    }

    private createHealthBar(player: Actor): void {
        this.barWidth = Math.max(24, player.Transform.ScaleX);
        this.hpBar = new Container();
        this.hpBar.position.set(-this.barWidth / 2 - 1, -player.Transform.ScaleY / 2 - 8);
        this.hpBar.addChild(this.barSprite(0x162326, this.barWidth + 2, 6, 0, 0));
        this.hpTrail = this.barSprite(0xf3cc83, this.barWidth, 4, 1, 1);
        this.hpFill = this.barSprite(player instanceof Enemy ? 0xef8d82 : 0x8fe0c2, this.barWidth, 4, 1, 1);
        this.hpBar.addChild(this.hpTrail, this.hpFill);
        this.addChild(this.hpBar);
    }
}
