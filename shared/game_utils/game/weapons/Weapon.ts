import { Actor } from "../objects/Actor";

export interface Weapon {
    equip(): void;
    use(user: Actor, position: [number, number], clickButton: number): void;
    hide(): void;
}
