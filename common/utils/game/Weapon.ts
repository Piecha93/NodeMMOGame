import {Actor} from "./Actor";

export interface Weapon {
    use(user: Actor, angle: number);
}