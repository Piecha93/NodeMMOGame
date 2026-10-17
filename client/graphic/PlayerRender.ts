import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Actor } from "../../shared/game_utils/game/objects/Actor";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { GameObjectAnimationRender } from "./GameObjectAnimationRender";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";
import { ActorFeedback, presentationPhase } from "./AnimationClock";
import { WeaponId } from "../../shared/gameplay/Adventure";

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
    private adventureBody = false;
    private heldWeapon: Container | null = null;
    private weaponShape: Graphics | null = null;
    private muzzle: Graphics | null = null;
    private weaponId: WeaponId = "ember";
    private aimAngle = 0;
    private shotRemainingMs = 0;
    private damageText: Text | null = null;
    private damageRemainingMs = 0;
    private previousHp = 0;

    public setObject(player: GameObject): void {
        if (!(player instanceof Actor)) throw new Error("Actor presentation requires an actor");
        super.setObject(player);
        this.playerReference = player;
        this.feedback = new ActorFeedback(player.HP, player.MaxHP);
        this.previousHp = player.HP;
        this.adventureBody = player.SpriteName.startsWith("wanderer_") || player.SpriteName.startsWith("wraith_");
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
        if (player.SpriteName.startsWith("wanderer_")) this.createWeapon();
        this.update(0);
    }

    public update(deltaMs: number = 1000 / 60): void {
        super.update(deltaMs);
        const player = this.playerReference;
        if (!player || !this.animation || !this.feedback) return;

        const elapsed = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
        this.elapsedMs += elapsed;
        if (this.adventureBody && player.HP < this.previousHp) this.showDamage(this.previousHp - player.HP);
        this.previousHp = player.HP;
        this.feedback.update(player.HP, player.MaxHP, deltaMs);
        const hit = this.feedback.hit;
        const moving = player.HP > 0 && (player.Horizontal !== 0 || player.Vertical !== 0);
        const gait = Math.sin((this.elapsedMs / 1000) * Math.PI * 6);
        const bob = moving ? Math.abs(gait) * 1.6 : Math.sin(this.elapsedMs / 500 + this.phase) * 0.45;
        this.animation.y = (this.adventureBody ? -player.Transform.ScaleY * 0.15 : 0) + (player.HP > 0 ? -bob : 4);
        this.animation.scale.x *= 1 + hit * 0.12;
        this.animation.scale.y *= 1 - hit * 0.1 + (moving ? gait * 0.025 : 0);
        this.animation.tint = flashTint(this.bodyColor, hit * 0.9);
        this.animation.alpha = player.HP > 0 ? 1 : 0.4;
        this.animation.rotation = player.HP > 0 ? hit * 0.08 : -0.45;
        if (this.shadow) this.shadow.scale.x = 1 - Math.max(0, bob) * 0.045;
        this.updateWeapon(elapsed, bob, player.HP > 0);
        if (this.damageText) {
            this.damageRemainingMs = Math.max(0, this.damageRemainingMs - elapsed);
            const age = 1 - this.damageRemainingMs / 650;
            this.damageText.visible = this.damageRemainingMs > 0;
            this.damageText.y = -player.Transform.ScaleY * 0.7 - age * 18;
            this.damageText.alpha = Math.min(1, this.damageRemainingMs / 160);
        }

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
        this.nameText.y = -this.objectRef.Transform.ScaleY * (this.adventureBody ? 0.75 : 0.5) - 12;
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
        this.hpBar.position.set(
            -this.barWidth / 2 - 1,
            -player.Transform.ScaleY * (this.adventureBody ? 0.75 : 0.5) - 8,
        );
        this.hpBar.addChild(this.barSprite(0x162326, this.barWidth + 2, 6, 0, 0));
        this.hpTrail = this.barSprite(0xf3cc83, this.barWidth, 4, 1, 1);
        this.hpFill = this.barSprite(player instanceof Enemy ? 0xef8d82 : 0x8fe0c2, this.barWidth, 4, 1, 1);
        this.hpBar.addChild(this.hpTrail, this.hpFill);
        this.addChild(this.hpBar);
    }

    public setAdventureWeapon(weapon: WeaponId): void {
        if (weapon === this.weaponId && this.weaponShape) return;
        this.weaponId = weapon;
        this.drawWeapon();
    }

    public aimAt(x: number, y: number): void {
        if (this.heldWeapon) this.aimAngle = Math.atan2(y - this.y, x - this.x);
    }

    /** A replicated projectile starts the local recoil; no extra network message is needed. */
    public fire(angle: number): void {
        if (!this.heldWeapon) return;
        this.aimAngle = angle;
        this.shotRemainingMs = 100;
    }

    private createWeapon(): void {
        this.heldWeapon = new Container();
        this.weaponShape = new Graphics();
        this.muzzle = new Graphics().poly([0, -5, 2, -1, 8, 0, 2, 1, 0, 5, -1, 1, -4, 0, -1, -1]).fill(0xfff0bf);
        this.muzzle.x = 17;
        this.muzzle.visible = false;
        this.heldWeapon.addChild(this.weaponShape, this.muzzle);
        this.addChild(this.heldWeapon);
        this.drawWeapon();
    }

    private drawWeapon(): void {
        const weapon = this.weaponShape;
        if (!weapon) return;
        weapon.clear();
        weapon.moveTo(-7, 0).lineTo(13, 0).stroke({ color: 0x6d4935, width: 3 });
        weapon.moveTo(-5, -0.5).lineTo(10, -0.5).stroke({ color: 0xd8af6f, width: 1 });
        weapon.rect(-1, -2, 3, 4).fill(0x816851);
        if (this.weaponId === "lance") {
            weapon.poly([19, 0, 12, -4, 9, 0, 12, 4]).fill(0x8eebdb);
            weapon.moveTo(6, -4).lineTo(6, 4).stroke({ color: 0x8cbdc1, width: 2 });
        } else if (this.weaponId === "scatter") {
            weapon.moveTo(9, 0).lineTo(12, -4).lineTo(16, -4).stroke({ color: 0xba935d, width: 2 });
            weapon.moveTo(9, 0).lineTo(12, 4).lineTo(16, 4).stroke({ color: 0xba935d, width: 2 });
            weapon.circle(16, -4, 2).fill(0xf3ae7b).circle(17, 0, 2).fill(0xffd698).circle(16, 4, 2).fill(0xf3ae7b);
        } else {
            weapon.circle(14, 0, 4).fill(0xbd7f44).circle(14.5, -0.5, 2.5).fill(0xffcf77);
            weapon.circle(15, -1, 1).fill(0xfff4c0);
        }
        if (this.muzzle) this.muzzle.tint = this.weaponId === "lance" ? 0xa2fff1 : 0xffffff;
    }

    private updateWeapon(elapsed: number, bob: number, alive: boolean): void {
        if (!this.heldWeapon) return;
        this.shotRemainingMs = Math.max(0, this.shotRemainingMs - elapsed);
        const recoil = this.shotRemainingMs / 100;
        this.heldWeapon.position.set(3 - Math.cos(this.aimAngle) * recoil * 3, 3 - bob);
        this.heldWeapon.rotation = this.aimAngle - recoil * 0.13;
        this.heldWeapon.visible = alive;
        if (this.muzzle) {
            this.muzzle.visible = recoil > 0.5;
            this.muzzle.alpha = recoil;
            this.muzzle.scale.set(0.7 + recoil * 0.5);
        }
        // The staff goes behind the torso while aiming up, keeping the silhouette legible.
        const spriteIndex = this.animation ? this.getChildIndex(this.animation) : 1;
        const weaponIndex = this.getChildIndex(this.heldWeapon);
        const behind = Math.sin(this.aimAngle) < -0.25;
        if ((behind && weaponIndex > spriteIndex) || (!behind && weaponIndex < spriteIndex))
            this.setChildIndex(this.heldWeapon, spriteIndex);
    }

    private showDamage(amount: number): void {
        if (!this.damageText) {
            this.damageText = new Text({
                text: "",
                style: {
                    fontFamily: "Arial",
                    fontSize: 12,
                    fontWeight: "bold",
                    fill: 0xffdaa0,
                    stroke: { color: 0x29252b, width: 3 },
                },
            });
            this.damageText.anchor.set(0.5, 1);
            this.addChild(this.damageText);
        }
        this.damageText.text = `${Math.round(amount)}`;
        this.damageRemainingMs = 650;
    }
}
