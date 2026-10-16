import { Projectile } from "./Projectile";
import { GameObject } from "./GameObject";
import { Transform } from "../../physics/Transform";
import { ChangesDict } from "../../../core/ChangeKeys";
import { Actor } from "./Actor";
import { Collision } from "../../physics/Collision";
import { Collider } from "../../physics/Collider";

export class FireBall extends Projectile {
    private power: number = 25;
    private owner: string = "";
    private ownerTeam: Actor["CombatTeam"] = null;
    private readonly collisionFilter = (other: Collider): boolean => {
        const object = other.Parent;
        if (object instanceof FireBall) {
            if (this.Runtime.config.cooperative && this.ownerTeam !== null && this.ownerTeam === object.ownerTeam)
                return false;
            return object.owner !== this.owner;
        }
        if (object instanceof Actor) {
            if (object.ID === this.owner) return false;
            if (!object.hasStableCombatTeam()) return true;
            const owner = this.ownerTeam === null ? this.ObjectsFactory.Manager.get(this.owner) : undefined;
            const team = this.ownerTeam ?? (owner instanceof Actor ? owner.CombatTeam : null);
            return !this.Runtime.config.cooperative || team === null || team !== object.CombatTeam;
        }
        return true;
    };

    constructor(transform: Transform) {
        super(transform);
        this.velocity = 1;

        this.lifeSpan = 2000;
        this.addChange(ChangesDict.VELOCITY);
    }

    protected serverOnCollisionEnter(collision: Collision) {
        super.serverOnCollisionEnter(collision);

        let gameObject: GameObject = collision.ColliderB.Parent;
        if (gameObject instanceof FireBall) {
            if (this.Runtime.config.cooperative && this.ownerTeam !== null && this.ownerTeam === gameObject.ownerTeam) {
                return;
            }
            if (gameObject.owner != this.owner) {
                this.destroy();
            }
        } else if (gameObject instanceof Actor) {
            if (gameObject.ID != this.owner) {
                const owner = this.ObjectsFactory.Manager.get(this.owner);
                const team = this.ownerTeam ?? (owner instanceof Actor ? owner.CombatTeam : null);
                if (this.Runtime.config.cooperative && team !== null && team === gameObject.CombatTeam) return;
                gameObject.hit(this.power);
                this.destroy();
            }
        } else if (gameObject.IsSolid) {
            this.destroy();
        }
    }

    override contactFilter(collider: Collider): ((other: Collider) => boolean) | null {
        if (
            this.constructor !== FireBall ||
            this.ownerTeam === null ||
            collider.IsTrigger ||
            collider.onCollisionEnter !== stockColliderHooks[0] ||
            collider.onCollisionStay !== stockColliderHooks[1] ||
            collider.onCollisionExit !== stockColliderHooks[2] ||
            (Projectile.prototype as unknown as Record<string, unknown>).serverOnCollisionEnter !== stockSuperEnter
        )
            return null;
        const hooks = this as unknown as Record<string, unknown>;
        for (const [name, implementation] of stockCollisionHooks) if (hooks[name] !== implementation) return null;
        return this.collisionFilter;
    }

    get Power(): number {
        return this.power;
    }

    get Owner(): string {
        return this.owner;
    }

    set Owner(value: string) {
        this.owner = value;
        this.ownerTeam = null;
        this.addChange(ChangesDict.OWNER);
    }

    public setOwner(owner: Actor): void {
        this.Owner = owner.ID;
        this.ownerTeam = owner.CombatTeam;
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        let sinAngle: number = Math.sin(this.transform.Rotation);
        let cosAngle: number = Math.cos(this.transform.Rotation);

        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;

        // console.log("updateeee " + [this.transform.X, this.transform.Y]);
        // console.log("vel " + this.velocity);
    }
}

const collisionHookNames = [
    "onCollisionEnter",
    "onCollisionStay",
    "onCollisionExit",
    "serverOnCollisionEnter",
    "serverOnCollisionStay",
    "serverOnCollisionExit",
    "sharedOnCollisionEnter",
    "sharedOnCollisionStay",
    "sharedOnCollisionExit",
] as const;
const stockCollisionHooks = collisionHookNames.map(
    (name) => [name, (FireBall.prototype as unknown as Record<string, unknown>)[name]] as const,
);
const stockColliderHooks = [
    Collider.prototype.onCollisionEnter,
    Collider.prototype.onCollisionStay,
    Collider.prototype.onCollisionExit,
];
const stockSuperEnter = (Projectile.prototype as unknown as Record<string, unknown>).serverOnCollisionEnter;
