import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";
import {SerializeFunctionsMap} from "./SerializeFunctionsMap";

SerializeFunctionsMap.set('position', serializePosition);

export abstract class GameObject {
    get Type(): string {
        return GameObjectType.GameObject.toString();
    }

    private static NEXT_ID: number = 0;

    private fCompleteUpdate: boolean = true;
    protected changes: Set<string>;
    protected position: Position;
    protected id: number = GameObject.NEXT_ID++;

    constructor(position: Position) {
        this.position = position;
        this.changes = new Set<string>();
    }

    forceCompleteUpdate() {
        this.fCompleteUpdate = true;
    }

    update() {

    }

    serialize(complete: boolean = false): string {
        let update: string = "";

        if(this.fCompleteUpdate) {
            this.fCompleteUpdate = false;
            complete = true;
        }

        if(complete) {
            SerializeFunctionsMap.forEach((serializeFunc: Function) => {
                update += serializeFunc(this);
            });
        } else {
            this.changes.forEach((field: string) => {
                if (SerializeFunctionsMap.has(field)) {
                    update += SerializeFunctionsMap.get(field)(this);
                    this.changes.delete(field);
                }
            });
        }

        this.changes.clear();

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

    get Position(): Position {
        return this.position;
    }

    get ID(): number {
        return this.id;
    }
}

function serializePosition(gameObject: GameObject): string {
    return '#P:' + gameObject.Position.X.toString() + ',' + gameObject.Position.Y.toString();
}