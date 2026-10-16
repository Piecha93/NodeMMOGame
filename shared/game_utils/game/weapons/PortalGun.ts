import { Actor } from "../objects/Actor";
import { Weapon } from "./Weapon";
import { Portal } from "../objects/Portal";
import { calcAngle } from "../../../utils/functions/CalcAngle";

export class PortalGun implements Weapon {
    private portals: [Portal | null, Portal | null] = [null, null];

    public use(user: Actor, position: [number, number], clickButton: number) {
        const portalNum: 0 | 1 = clickButton == 0 ? 0 : 1;

        let angle: number = calcAngle(position, [user.Transform.X, user.Transform.Y]);

        this.portals[portalNum]?.destroy();
        const portal = user.ObjectsFactory.instantiateWithPosition("Portal", user.Transform.Position);
        if (!(portal instanceof Portal)) throw new Error("Portal prefab must instantiate a portal");
        this.portals[portalNum] = portal;

        portal.Transform.Rotation = angle;

        portal.addDestroyListener(() => {
            if (this.portals[portalNum] === portal) this.portals[portalNum] = null;
        });

        this.copulePortals();
    }

    private copulePortals() {
        if (this.portals[0] != null && this.portals[1] != null) {
            this.portals[0].CouplingPortal = this.portals[1];
            this.portals[1].CouplingPortal = this.portals[0];
        }
    }

    equip() {}

    hide() {
        for (const portal of this.portals) portal?.destroy();
        this.portals = [null, null];
    }
}
