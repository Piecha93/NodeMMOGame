import {Actor} from "../objects/Actor";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../../factory/ObjectsFactory";
import {MouseKeys} from "../../../input/InputCommands";


export class ObjectsSpawner implements Weapon {
    public use(user: Actor, position: [number, number], clickButton: number) {
        for(let i = 0; i < 1; i++) {
            if (clickButton == MouseKeys.LEFT) {
                let gg = GameObjectsFactory.InstatiateWithPosition("Michau", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]) as Actor;
                gg.Name = "Michau " + gg.ID;
            } else if (clickButton == MouseKeys.RIGHT) {
                GameObjectsFactory.InstatiateWithPosition("Wall", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
            } else {
                GameObjectsFactory.InstatiateWithPosition("Doors", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
            }
        }
    };

    equip() {
    }

    hide() {
    }
}