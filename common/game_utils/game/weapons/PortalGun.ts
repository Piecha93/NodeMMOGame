import {Actor} from "../objects/Actor";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../../factory/ObjectsFactory";
import {Transform} from "../../physics/Transform";
import {Portal} from "../objects/Portal";
import {calcAngle} from "../../../utils/functions/CalcAngle";

export class PortalGun implements Weapon {
    private portals: [Portal, Portal] = [null, null];

    public use(user: Actor, position: [number, number], clickButton: number) {
        let portalNum = clickButton == 0 ? 0 : 1;

        let angle: number = calcAngle(position, [user.Transform.X, user.Transform.Y]);

        let transform = new Transform(user.Transform.X, user.Transform.Y, 75, 75);
        transform.Rotation = angle;

        if(this.portals[portalNum] != null) {
            this.portals[portalNum].destroy();
        }
        this.portals[portalNum] = GameObjectsFactory.InstatiateWithTransform("Portal", transform) as Portal;

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

    equip() {
    }

    hide() {
        for(let i in [0,1]) {
            if (this.portals[i]) {
                this.portals[i].destroy();
                this.portals[i] = null;
            }
        }
    }
}