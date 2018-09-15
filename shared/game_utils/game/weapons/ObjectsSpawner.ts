import {Actor} from "../objects/Actor";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../../factory/ObjectsFactory";


export class ObjectsSpawner implements Weapon {
    public use(user: Actor, position: [number, number], clickButton: number) {
        for(let i = 0; i < 1; i++) {
            if (clickButton == 0) {
                let gg = GameObjectsFactory.InstatiateWithPosition("Michau", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]) as Actor;
                gg.Name = "Michau " + gg.ID;
            } else if (clickButton == 2) {
                GameObjectsFactory.InstatiateWithPosition("Wall", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
            } else {
                GameObjectsFactory.InstatiateWithPosition("HpPotion", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
            }
        }
    };

    equip() {
    }

    hide() {
    }
}