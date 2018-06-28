import {Actor} from "./Actor";

export interface Weapon {
    equip();
    use(user: Actor, angle: number, clickButton: number);
    hide();
}