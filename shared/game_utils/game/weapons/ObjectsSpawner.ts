import {Actor} from "../objects/Actor";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../../factory/ObjectsFactory";
import {Transform} from "../../physics/Transform";

export class ObjectsSpawner implements Weapon {
    public use(user: Actor, position: [number, number], clickButton: number) {
        if(clickButton == 0) {
            GameObjectsFactory.InstatiateWithPosition("Michau", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
        } else if(clickButton == 2) {
            GameObjectsFactory.InstatiateWithPosition("Wall", [Math.round(position[0] /32) * 32, Math.round(position[1] /32) * 32]);
        } else {
            GameObjectsFactory.InstatiateWithPosition("HpPotion", [Math.round(position[0] /32) * 32, Math.round(position[1] /32) * 32]);
        }
    };

    equip() {
    }

    hide() {
    }
}