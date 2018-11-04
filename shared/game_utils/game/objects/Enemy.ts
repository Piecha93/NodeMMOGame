import {Transform} from "../../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {MagicWand} from "../weapons/MagicWand";
import {GameObject} from "./GameObject";
import {Collision} from "../../physics/Collision";

export class Enemy extends Actor {
    private timeSinceLastShot = 1000;

    constructor(transform: Transform) {
        super(transform);
        this.velocity = 0.2;

        this.weapon = new MagicWand();
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }

    protected serverOnCollisionEnter(collision: Collision) {
        super.serverOnCollisionEnter(collision);

        let gameObject: GameObject = collision.ColliderB.Parent;
        if(gameObject.IsSolid) {
            this.Horizontal = Math.round(Math.random() * 2) - 1;
            this.Vertical = Math.round(Math.random() * 2) - 1;
        }
    }

    protected serverUpdate(delta: number) {
        if(this.HP <= 0) {
            this.destroy();
            return;
        }

        this.timeSinceLastShot -= delta;
        if(this.timeSinceLastShot <= 0) {
            this.timeSinceLastShot = Math.random() * 2000;
            for(let i = 0; i < 1; i++) {
                let pos: [number, number] = [(Math.random() * 2) - 1, (Math.random() * 2) - 1];
                pos[0] += this.Transform.X;
                pos[1] += this.Transform.Y;
                this.weapon.use(this, pos, 0);

                this.Horizontal = Math.round(Math.random() * 2) - 1;
                this.Vertical = Math.round(Math.random() * 2) - 1;
            }
        }

        this.updatePosition(delta);

        this.transform.addChange(ChangesDict.X);
        this.transform.addChange(ChangesDict.Y);
    }
}

