import {Actor} from "../objects/Actor";

export interface Weapon {
    equip();
    use(user: Actor, angle: number, clickButton: number);
    hide();
}