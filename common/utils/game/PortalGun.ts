import {Actor} from "./Actor";
import {FireBall} from "./FireBall";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../factory/ObjectsFactory";
import {Transform} from "../physics/Transform";
import {Portal} from "./Portal";

export class PortalGun implements Weapon {
    private portalA: Portal = null;
    private portalB: Portal = null;

    public use(user: Actor, angle: number) {
        let position = new Transform(user.Transform.X, user.Transform.Y, 20);
        position.Rotation = angle;

        if(this.portalA == null) {
            this.portalA = GameObjectsFactory.InstatiateWithTransform("Portal", position) as Portal;
            this.portalA.addDestroyListener(() => {
                this.portalA = null;
            });
        } else if(this.portalB == null) {
            this.portalB = GameObjectsFactory.InstatiateWithTransform("Portal", position) as Portal;
            this.portalA.CouplingPortal = this.portalB;
            this.portalB.CouplingPortal = this.portalA;

            this.portalB.addDestroyListener(() => {
                this.portalB = null;
            });
        }
    };
}