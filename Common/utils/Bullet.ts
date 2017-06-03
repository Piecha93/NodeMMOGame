import {GameObject} from "./GameObject";
import {Position} from "../../Common/utils/Position";
import {GameObjectType} from "../../Common/utils/GameObjectTypes";

export class Bullet extends GameObject {
    get Type(): string {
        return GameObjectType.Bullet.toString();
    }

    private velocity: number = 10;
    private direction: number = 0;

    private lifeSpan = 3;

    constructor() {
        super(new Position(200,200));

        this.spriteName = "bullet"
    }

    public update() {
        this.position.X = this.position.X + 1;
        this.changes.add('position');
    }
}