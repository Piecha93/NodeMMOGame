import {Position} from "./Position";
import {GameObjectType, TypeIdMap} from "./GameObjectTypes";

export abstract class GameObject {
    get Type(): string {
        return GameObjectType.GameObject.toString();
    }

    private static NEXT_ID: number = 0;

    protected position: Position;
    protected id: number = GameObject.NEXT_ID++;

    constructor(position: Position) {
        this.position = position;
    }

    get Position(): Position {
        return this.position;
    }

    get ID(): number {
        return this.id;
    }

    update() {

    }

    serialize(): string {
        let position: string = '#P:' + this.position.X.toString() + ',' + this.position.Y.toString();

        let update: string = position;
        return update;
    }

    deserialize(update: string[]) {
        for(let item of update) {
            if(item.startsWith('P')) {
                this.updatePosition(item.split(':')[1]);
            }
        }
    }

    private updatePosition(data: string) {
        let x: string = data.split(',')[0];
        let y: string = data.split(',')[1];

        this.position.X = parseFloat(x);
        this.position.Y = parseFloat(y);
    }
}