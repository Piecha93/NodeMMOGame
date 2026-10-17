import { integrateMovement, movementFactors } from "../../../core/Movement";
import { GameObject } from "./GameObject";
import { Transform } from "../../physics/Transform";
import { ChangesDict } from "../../../core/ChangeKeys";
import { Weapon } from "../weapons/Weapon";
import { Collision } from "../../physics/Collision";
import { Collider } from "../../physics/Collider";

const baseCollisionHooks = GameObject.prototype as unknown as Record<string, unknown>;
const emptyCollisionHooks = [
    "onCollisionEnter",
    "onCollisionStay",
    "onCollisionExit",
    "serverOnCollisionEnter",
    "serverOnCollisionStay",
    "serverOnCollisionExit",
    "sharedOnCollisionEnter",
    "sharedOnCollisionExit",
].map((name) => [name, baseCollisionHooks[name]] as const);
const emptySharedStay = baseCollisionHooks.sharedOnCollisionStay;
const colliderEnter = Collider.prototype.onCollisionEnter;
const colliderStay = Collider.prototype.onCollisionStay;
const colliderExit = Collider.prototype.onCollisionExit;

export abstract class Actor extends GameObject {
    private name: string;
    private maxHp: number;
    private hp: number;
    protected animationType: string;
    protected horizontal: number = 0;
    protected vertical: number = 0;

    protected weapon: Weapon | null = null;

    protected constructor(transform: Transform) {
        super(transform);

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;
        this.name = "";

        this.animationType = "idle";
    }

    public updatePosition(delta: number) {
        if (this.HP <= 0) return;
        const [x, y] = integrateMovement(
            {
                x: this.Transform.X,
                y: this.Transform.Y,
                velocity: this.velocity,
                horizontal: this.horizontal,
                vertical: this.vertical,
            },
            delta,
        );
        if (x !== this.Transform.X) this.Transform.X = x;
        if (y !== this.Transform.Y) this.Transform.Y = y;
    }

    override canSkipNonSolidContacts(collider: Collider): boolean {
        if (
            collider.IsTrigger ||
            collider.onCollisionEnter !== colliderEnter ||
            collider.onCollisionStay !== colliderStay ||
            collider.onCollisionExit !== colliderExit ||
            baseCollisionHooks.sharedOnCollisionStay !== emptySharedStay
        )
            return false;
        const hooks = this as unknown as Record<string, unknown>;
        if (hooks.sharedOnCollisionStay !== actorSharedStay) return false;
        // A stock actor only resolves solid obstacles. Pickups, shots and portals
        // process their own directional contacts. Custom hooks keep every pair.
        return (
            hooks.onCollisionEnter === emptyCollisionHooks[0]![1] &&
            hooks.onCollisionStay === emptyCollisionHooks[1]![1] &&
            hooks.onCollisionExit === emptyCollisionHooks[2]![1] &&
            hooks.serverOnCollisionEnter === emptyCollisionHooks[3]![1] &&
            hooks.serverOnCollisionStay === emptyCollisionHooks[4]![1] &&
            hooks.serverOnCollisionExit === emptyCollisionHooks[5]![1] &&
            hooks.sharedOnCollisionEnter === emptyCollisionHooks[6]![1] &&
            hooks.sharedOnCollisionExit === emptyCollisionHooks[7]![1]
        );
    }

    protected sharedOnCollisionStay(collision: Collision) {
        super.sharedOnCollisionStay(collision);

        let gameObject: GameObject = collision.ColliderB.Parent;
        if (gameObject.IsSolid) {
            this.Transform.X -= collision.Result.overlap * collision.Result.overlap_x;
            this.Transform.Y -= collision.Result.overlap * collision.Result.overlap_y;
        }
    }

    hit(power: number) {
        if (!Number.isFinite(power) || power <= 0 || this.hp <= 0) return;
        this.hp = Math.max(0, this.hp - power);
        if (this.hp === 0) {
            this.Horizontal = 0;
            this.Vertical = 0;
        }
        this.addChange(ChangesDict.HP);
    }

    heal(power: number) {
        if (!Number.isFinite(power) || power <= 0 || this.hp <= 0 || this.hp === this.maxHp) return;
        this.hp = Math.min(this.maxHp, this.hp + power);
        this.addChange(ChangesDict.HP);
    }

    public configureVitals(maxHp: number): void {
        if (!Number.isFinite(maxHp) || maxHp <= 0) throw new RangeError("Invalid maximum health");
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.addChange(ChangesDict.MAX_HP);
        this.addChange(ChangesDict.HP);
    }

    get CombatTeam(): "players" | "enemies" | null {
        return null;
    }

    public hasStableCombatTeam(): boolean {
        return false;
    }

    public parseMoveDir(): [number, number] {
        return movementFactors(this.horizontal, this.vertical);
    }

    get MaxHP(): number {
        return this.maxHp;
    }

    get HP(): number {
        return this.hp;
    }

    get Name(): string {
        return this.name;
    }

    set Name(name: string) {
        this.name = name;
        this.addChange(ChangesDict.NAME);
    }

    set Horizontal(horizontal: number) {
        if (this.horizontal == horizontal) return;

        this.horizontal = horizontal;
        this.addChange(ChangesDict.HORIZONTAL);

        this.setAnimationType();
    }

    set Vertical(vertical: number) {
        if (this.vertical == vertical) return;

        this.vertical = vertical;
        this.addChange(ChangesDict.VERTICAL);

        this.setAnimationType();
    }

    private setAnimationType() {
        const animationType = this.horizontal !== 0 || this.vertical !== 0 ? "run" : "idle";
        if (this.animationType === animationType) return;
        this.animationType = animationType;
        this.addChange(ChangesDict.ANIMATION_TYPE);
    }

    get Horizontal(): number {
        return this.horizontal;
    }

    get Vertical(): number {
        return this.vertical;
    }

    get SpriteName(): string {
        return this.spriteName + "_" + this.animationType;
    }

    get Weapon(): Weapon | null {
        return this.weapon;
    }

    set SpriteName(spriteName: string) {
        this.spriteName = spriteName;
        this.addChange(ChangesDict.SPRITE_ID);
    }

    set Weapon(weapon: Weapon | null) {
        this.weapon = weapon;
    }
}

const actorSharedStay = (Actor.prototype as unknown as Record<string, unknown>).sharedOnCollisionStay;
