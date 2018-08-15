import {Actor} from "../objects/Actor";

export interface Weapon {
    equip();
    use(user: Actor, position: [number, number], clickButton: number);
    hide();
}