import {Actor} from "../objects/Actor";
import {Weapon} from "./Weapon";
import {GameObjectsFactory} from "../../factory/ObjectsFactory";
import {Transform} from "../../physics/Transform";

export class ObjectsSpawner implements Weapon {
    public use(user: Actor, position: [number, number], clickButton: number) {
        if(clickButton == 0) {
            GameObjectsFactory.InstatiateWithTransform("Enemy", new Transform(Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32, 32, 32))
        } else if(clickButton == 2) {
            GameObjectsFactory.InstatiateWithTransform("Obstacle", new Transform(Math.round(position[0] /32) * 32, Math.round(position[1] /32) * 32, 32, 32))
        } else {
            GameObjectsFactory.InstatiateWithTransform("Item", new Transform(Math.round(position[0] /32) * 32, Math.round(position[1] /32) * 32, 32, 32))
        }
    };

    equip() {
    }

    hide() {
    }
}