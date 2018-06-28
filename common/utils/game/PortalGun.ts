import {Actor} from "./Actor";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../factory/ObjectsFactory";
import {Transform} from "../physics/Transform";
import {Portal} from "./Portal";

export class PortalGun implements Weapon {
    private portals: [Portal, Portal] = [null, null];

    public use(user: Actor, angle: number, clickButton: number) {
        let portalNum = clickButton == 0 ? 0 : 1;

        let position = new Transform(user.Transform.X, user.Transform.Y, 75, 75);
        position.Rotation = angle;

        if(this.portals[portalNum] != null) {
            this.portals[portalNum].destroy();
        }
        this.portals[portalNum] = GameObjectsFactory.InstatiateWithTransform("Portal", position) as Portal;

        this.portals[portalNum].addDestroyListener(() => {
            this.portals[portalNum] = null;
        });

        this.copulePortals();
    };

    private copulePortals() {
        if(this.portals[0] != null && this.portals[1] != null) {
            this.portals[0].CouplingPortal = this.portals[1];
            this.portals[1].CouplingPortal = this.portals[0];
        }
    }
}